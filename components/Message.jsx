import { cloneDeep, isEqual } from 'lodash';
import React, { memo, useState, useEffect } from 'react';
const { user, constants: { Constants, ActionTypes } } = require('@vizality/discord');
import { getModule, FluxDispatcher } from '@vizality/webpack';
import { findInReactTree } from '@vizality/util/react';

import getColor from '../api/getColor';
import getMessage from '../api/getMessage';

const Message = getModule(m => m.prototype?.isEdited);
const Timestamp = getModule(m => m.prototype?.toDate && m.prototype?.month);

const { MessageAccessories } = getModule(m => m.MessageAccessories);
const StickerMessage = getModule(m => m.displayName === 'StickerMessage');

const { getChannel } = getModule(m => m.getChannel && m.hasChannel);
const { parse } = getModule('parse', 'defaultRules');

const changeDelete = (object, changeFrom, changeTo) => {
  if (object && object[changeFrom]) {
    Object.defineProperty(object, changeTo,
      Object.getOwnPropertyDescriptor(object, changeFrom));
    delete object[changeFrom];
  }
};

const videoEmbed = video => {
  const newVideoEmbed = {
    video: cloneDeep(video),
    thumbnail: {
      url: `${video.proxy_url ?? video.proxyURL}?format=jpeg`,
      proxy_url: `${video.proxy_url ?? video.proxyURL}?format=jpeg`,
      height: video.height,
      width: video.width
    },
    url: video.url
  };
  changeDelete(newVideoEmbed.video, 'proxy_url', 'proxyURL');

  return newVideoEmbed;
};

const CustomMessage = memo(({ channelId, embed, attachment }) => {
  const message = {
    attachments: [ attachment ].filter(attachment => attachment),
    embeds: [ embed ].filter(embed => embed)
  };

  return <MessageAccessories message={new Message(message)} channel={getChannel(channelId)} gifAutoPlay={true} inlineAttachmentMedia={true} inlineEmbedMedia={true} />;
}, (prevProps, nextProps) => {
  const equal = [];
  for (const [ key, value ] of Object.entries(prevProps.embed)) {
    equal.push(isEqual(value, nextProps.embed[key]) || key === 'footer');
  }
  return !equal.includes(false);
});

export default memo(({ guildId, channelId, messageId, count }) => {
  const [ update, setUpdate ] = useState(true);
  const [ message, setMessage ] = useState('');

  useEffect(() => {
    const Update = args => {
      if (args.message.id !== messageId) return;
      setUpdate('update');
    };

    if (update) {
      (async () => {
        setMessage(await getMessage(channelId, messageId, update));
        setUpdate(false);
      })();
    }

    FluxDispatcher.subscribe(ActionTypes.MESSAGE_UPDATE, Update);
    return () => FluxDispatcher.unsubscribe(ActionTypes.MESSAGE_UPDATE, Update);
  }, [ update ]);

  if (update) return <CustomMessage channelId={channelId} embed={{ rawTitle: 'Loading...' }} />;
  if (!message) return null;
  if (Object.keys(message).length === 0) return <CustomMessage channelId={channelId} embed={{ rawTitle: 'Error Fetching Message!' }} />;

  const parsedMessageContent = parse(message.content, true, { channelId });
  const maskedLink = findInReactTree(parsedMessageContent, m => m.type?.displayName === 'MaskedLink');
  if (maskedLink) maskedLink.props.count = count + 1;
  const embed = {
    color: getColor(guildId, message.author.id),
    author: {
      name: parse(`<@${message.author.id}>`, true, { channelId }),
      iconProxyURL: user.getAvatarUrl(message.author.id, guildId, 24, true)
    },
    rawDescription: getModule(m => m.displayName === 'renderMessageContent')({ message }, parsedMessageContent),
    fields: [],
    footer: {
      text: parse(`<#${channelId}>`, true, { channelId })
    },
    timestamp: typeof message.timestamp !== 'object' ? new Timestamp(message.timestamp) : message.timestamp
  };

  for (const attachment of message.attachments) {
    const type = attachment.content_type?.match(/image|video/)?.[0];

    switch (type) {
      case 'image': {
        if (!attachment.filename.endsWith('.bmp')) {
          const newEmbed = {
            image: {
              url: attachment.url,
              proxy_url: attachment.proxy_url,
              height: attachment.height,
              width: attachment.width
            }
          };
          embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={newEmbed} />, inline: false });
        }
        break;
      }
      case 'video': {
        embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={videoEmbed(attachment)} />, inline: false });
        break;
      }
      default: {
        if (Constants.IMAGE_RE.test(attachment.filename)) {
          embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={{ image: cloneDeep(attachment) }} />, inline: false });
        } else if ((/\.mov$/i).test(attachment.filename)) {
          embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={videoEmbed(attachment)} />, inline: false });
        } else embed.fields.push({ rawValue: <CustomMessage channelId={channelId} attachment={cloneDeep(attachment)} />, inline: false });
      }
    }
  }

  for (const messageEmbed of message.embeds) {
    const { type } = messageEmbed;
    const newEmbed = cloneDeep(messageEmbed);

    if (message.fetchedMessage) {
      newEmbed.color = newEmbed.color ? `#${newEmbed.color.toString(16)}` : '';
      changeDelete(newEmbed, 'title', 'rawTitle');
      changeDelete(newEmbed, 'description', 'rawDescription');
      if (newEmbed.author) {
        changeDelete(newEmbed.author, 'icon_url', 'iconURL');
        changeDelete(newEmbed.author, 'proxy_icon_url', 'iconProxyURL');
      }
      if (newEmbed.fields) {
        for (const field of newEmbed.fields) {
          changeDelete(field, 'name', 'rawName');
          changeDelete(field, 'value', 'rawValue');
        }
      }
      if (newEmbed.footer) {
        changeDelete(newEmbed.footer, 'icon_url', 'iconURL');
        changeDelete(newEmbed.footer, 'proxy_icon_url', 'iconProxyURL');
      }
    }

    switch (type) {
      case 'rich': {
        if (typeof newEmbed.timestamp !== 'object' && typeof newEmbed.timestamp !== 'undefined') newEmbed.timestamp = new Timestamp(newEmbed.timestamp);
        break;
      }
      case 'image': {
        changeDelete(newEmbed, 'thumbnail', 'image');
        break;
      }
    }

    embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={newEmbed} />, inline: false });
  }

  for (const sticker of message.stickerItems) {
    embed.fields.push({ rawValue: <StickerMessage renderableSticker={sticker} channel={getChannel(channelId)} />, inline: false });
  }

  return <CustomMessage channelId={channelId} embed={embed} />;
});
