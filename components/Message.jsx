import React, { memo, useState, useEffect } from 'react';
import { getModule, FluxDispatcher } from '@vizality/webpack';
import { findInReactTree } from '@vizality/util/react';

import getColor from '../api/getColor';
import getMessage from '../api/getMessage';

const Message = getModule(m => m.prototype?.isEdited);
const Timestamp = getModule(m => m.prototype?.toDate && m.prototype.month);

const { MessageAccessories } = getModule(m => m.MessageAccessories);
const StickerMessage = getModule(m => m.displayName === 'StickerMessage');

const Constants = getModule(m => m.API_HOST);
const { getChannel } = getModule(m => m.getChannel && m.hasChannel);
const { parse } = getModule(m => m.parse && m.defaultRules);
const { getUser } = getModule(m => m.getUser && m.getUsers);
const { IMAGE_RE, VIDEO_RE } = getModule(m => m.IMAGE_RE);

const changeDelete = (object, changeFrom, changeTo) => {
  if (object && object[changeFrom]) {
    Object.defineProperty(object, changeTo,
      Object.getOwnPropertyDescriptor(object, changeFrom));
    delete object[changeFrom];
  }
};

const videoEmbed = video => {
  const newVideoEmbed = {
    video: {
      url: video.url,
      proxyURL: video.proxy_url,
      height: video.height,
      width: video.width
    },
    thumbnail: {
      url: `${video.proxy_url}?format=jpeg`,
      height: video.height,
      width: video.width
    },
    url: video.url
  };

  return newVideoEmbed;
};

const CustomMessage = memo(({ channelId, embed, attachment }) => {
  const message = {
    attachments: [ attachment ].filter(attachment => attachment),
    embeds: [ embed ].filter(embed => embed)
  };

  return <MessageAccessories message={new Message(message)} channel={getChannel(channelId)} gifAutoPlay={true} inlineAttachmentMedia={true} inlineEmbedMedia={true} />;
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
      getMessage(channelId, messageId, update).then(setMessage);
      setUpdate(false);
    }

    FluxDispatcher.subscribe(Constants.ActionTypes.MESSAGE_UPDATE, Update);
    return () => FluxDispatcher.unsubscribe(Constants.ActionTypes.MESSAGE_UPDATE, Update);
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
      iconProxyURL: getUser(message.author.id)?.getAvatarURL(guildId, 24, true)
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
        if (!attachment.filename.endsWith('.bmp')) embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={{ image: attachment }} />, inline: false });
        break;
      }
      case 'video': {
        embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={videoEmbed(attachment)} />, inline: false });
        break;
      }
      default: {
        if (IMAGE_RE.test(attachment.filename)) embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={{ image: attachment }} />, inline: false });
        else if (VIDEO_RE.test(attachment.filename)) embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={videoEmbed(attachment)} />, inline: false });
        else embed.fields.push({ rawValue: <CustomMessage channelId={channelId} attachment={attachment} />, inline: false });
      }
    }
  }

  for (const messageEmbed of message.embeds) {
    const { type } = messageEmbed;

    if (message.fetchedMessage) {
      if (messageEmbed.color) messageEmbed.color = `#${messageEmbed.color.toString(16)}`;
      changeDelete(messageEmbed, 'title', 'rawTitle');
      changeDelete(messageEmbed, 'description', 'rawDescription');
      changeDelete(messageEmbed.author, 'icon_url', 'iconURL');
      changeDelete(messageEmbed.author, 'proxy_icon_url', 'iconProxyURL');
      changeDelete(messageEmbed.thumbnail, 'proxy_url', 'proxyURL');
      if (messageEmbed.fields) {
        for (const field of messageEmbed.fields) {
          changeDelete(field, 'name', 'rawName');
          changeDelete(field, 'value', 'rawValue');
        }
      }
      changeDelete(messageEmbed.footer, 'icon_url', 'iconURL');
      changeDelete(messageEmbed.footer, 'proxy_icon_url', 'iconProxyURL');
      if (messageEmbed.timestamp) messageEmbed.timestamp = new Timestamp(messageEmbed.timestamp);
    }

    if (type === 'image') changeDelete(messageEmbed, 'thumbnail', 'image');

    embed.fields.push({ rawValue: <CustomMessage channelId={channelId} embed={messageEmbed} />, inline: false });
  }

  for (const sticker of message.stickerItems) {
    embed.fields.push({ rawValue: <StickerMessage renderableSticker={sticker} channel={getChannel(channelId)} />, inline: false });
  }

  return <CustomMessage channelId={channelId} embed={embed} />;
});
