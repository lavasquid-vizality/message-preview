import { cloneDeep, isEqual } from 'lodash';
import React, { memo, useState, useEffect } from 'react';
import { user } from '@vizality/discord';
import { Constants } from '@vizality/discord/constants';
import { getModule, FluxDispatcher } from '@vizality/webpack';

import getColor from '../api/getColor';
import getMessage from '../api/getMessage';

const Message = getModule(m => m.prototype?.isEdited);
const Timestamp = getModule(m => m.prototype?.toDate && m.prototype?.month);

const { MessageAccessories } = getModule(m => m.MessageAccessories);
const StickerMessage = getModule(m => m.displayName === 'StickerMessage');

const { getChannel } = getModule(m => m.getChannel);
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

const CustomMessage = memo(({ channelId, embed }) => {
  return <MessageAccessories message={new Message({ embeds: [ embed ] })} channel={getChannel(channelId)} gifAutoPlay={true} inlineAttachmentMedia={true} inlineEmbedMedia={true} />;
}, (prevProps, nextProps) => {
  const equal = [];
  for (const [ key, value ] of Object.entries(prevProps.embed)) {
    equal.push(isEqual(value, nextProps.embed[key]) || key === 'footer');
  }
  return !equal.includes(false);
});

export const CustomEmbed = memo(({ guildId, channelId, messageId }) => {
  const [ update, setUpdate ] = useState(true);
  const [ message, setMessage ] = useState('');

  useEffect(() => {
    const Update = (args) => {
      if (args.message.id !== messageId) return;
      setUpdate('update');
    };

    if (update) {
      (async () => {
        setMessage(await getMessage(channelId, messageId, update));
        setUpdate(false);
      })();
    }

    FluxDispatcher.subscribe(Constants.ActionTypes.MESSAGE_UPDATE, Update);
    return () => FluxDispatcher.unsubscribe(Constants.ActionTypes.MESSAGE_UPDATE, Update);
  }, [ update ]);

  if (update) return <CustomMessage channelId={channelId} embed={{ rawTitle: 'Loading...' }} />;
  if (Object.keys(message).length === 0) return <CustomMessage channelId={channelId} embed={{ rawTitle: 'Error Fetching Message!' }} />;

  const embed = {
    color: getColor(guildId, message.author.id),
    author: {
      name: parse(`<@${message.author.id}>`, true, { channelId }),
      iconProxyURL: user.getAvatarUrl(message.author.id, guildId, 24, true)
    },
    rawDescription: getModule(m => m.displayName === 'renderMessageContent')({ message }, parse(message.content, true, { channelId })),
    fields: [],
    footer: {
      text: parse(`<#${channelId}>`, true, { channelId })
    },
    timestamp: typeof message.timestamp !== 'object' ? new Timestamp(message.timestamp) : message.timestamp
  };

  for (const attachment of message.attachments) {
    const type = attachment.content_type?.match(/image|video/)[0];

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
        }
      }
    }
  }

  for (const messageEmbed of message.embeds) {
    const { type } = messageEmbed;
    const newEmbed = cloneDeep(messageEmbed);

    switch (type) {
      case 'rich': {
        if (message.fetchedMessage) {
          newEmbed.color = `#${newEmbed.color.toString(16)}`;
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
        if (typeof newEmbed.timestamp !== 'object' && typeof newEmbed.timestamp !== 'undefined') newEmbed.timestamp = new Timestamp(newEmbed.timestamp);
        embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={newEmbed} />, inline: false });
        break;
      }
      case 'image': {
        changeDelete(newEmbed, 'thumbnail', 'image');
        embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={newEmbed} />, inline: false });
        break;
      }
      default: {
        embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={newEmbed} />, inline: false });
      }
    }
  }

  for (const sticker of message.stickerItems) {
    embed.fields.push({ rawValue: <StickerMessage renderableSticker={sticker} channel={getChannel(channelId)} />, inline: false });
  }

  return <CustomMessage channelId={channelId} embed={embed} />;
});
