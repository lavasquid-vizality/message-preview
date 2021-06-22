/* global _ */
import React, { memo, useState, useEffect } from 'react';
import { user } from '@vizality/discord';
import { getModule } from '@vizality/webpack';

import getColor from '../api/getColor';
import getMessage from '../api/getMessage';

const MessageTemplate = getModule(m => m.prototype?.isEdited);
const Timestamp = getModule(m => m.prototype?.toDate && m.prototype?.month);
const { getChannel } = getModule(m => m.getChannel);
const { MessageAccessories } = getModule('MessageAccessories');
const { parse } = getModule('parse', 'parseTopic');

const Message = memo(({ message }) => {
  return message.content ? <div>{getModule(m => m.displayName === 'renderMessageContent')({ message }, message.content)}</div> : <div>{message}</div>;
}, (prevProps, nextProps) => {
  return _.isEqual(prevProps, nextProps);
});

export const CustomEmbed = memo(({ guildId, channelId, messageId }) => {
  const [ loading, setLoading ] = useState(true);
  const [ message, setMessage ] = useState('');

  useEffect(() => {
    (async () => {
      setMessage(await getMessage(channelId, messageId));
      setLoading(false);
    })();
  }, []);

  if (loading) return <MessageAccessories message={new MessageTemplate({ embeds: [ { rawTitle: 'Loading...' } ] })} channel={getChannel(channelId)} />;
  if (Object.keys(message).length === 0) return <MessageAccessories message={new MessageTemplate({ embeds: [ { rawTitle: 'Error Fetching Message!' } ] })} channel={getChannel(channelId)} />;

  let embed = {
    color: getColor(guildId, message.author.id),
    author: {
      name: message.author.username,
      iconProxyURL: user.getAvatarUrl(message.author.id),
      url: `https://discord.com/users/${message.author.id}`
    },
    rawDescription: <Message message={message} />,
    footer: {
      text: parse(`<#${message.channel_id}>`)
    },
    timestamp: message.timestamp
  };

  for (const attachment of message.attachments) {
    const type = attachment.content_type.match(/image|video/)[0];

    if (type === 'image') {
      embed.image = {
        url: attachment.url,
        proxy_url: attachment.proxy_url,
        height: attachment.height,
        width: attachment.width
      };
    } else if (type === 'video') {
      embed.rawDescription = '';
      embed.video = Object.assign({}, attachment);
      embed.video.url = attachment.proxy_url;
      embed.thumbnail = {
        url: `${attachment.proxy_url}?format=jpeg`,
        proxy_url: `${attachment.proxy_url}?format=jpeg`,
        height: attachment.height,
        width: attachment.width
      };
      embed.url = attachment.url;
    }
  }
  for (const messageEmbed of message.embeds) {
    const { type } = messageEmbed;

    if (type === 'video') {
      Object.assign(embed, messageEmbed);
    } else {
      if (messageEmbed.type === 'rich') {
        embed = Object.assign({}, messageEmbed);
        delete embed.id;

        if (message.fetchedMessage) {
          embed.color = `rgb(${embed.color & 0xFF}, ${(embed.color & 0xFF00) >> 8}, ${(embed.color & 0xFF0000) >> 16})`;
          embed.rawTitle = embed.title;
          delete embed.title;
          if (!message.fetchedMessageFixed) {
            for (const field of embed.fields) {
              field.rawName = field.name;
              field.rawValue = field.value;
              delete field.name;
              delete field.value;
            }
            message.fetchedMessageFixed = true;
          }
        }
        if (embed.rawTitle && !embed.rawTitle.includes('(Embed) - ')) embed.rawTitle = `(Embed) - ${embed.rawTitle}`;
        if (typeof embed.footer?.text[0] !== 'object') {
          embed.footer = (embed.footer?.text) ? { text: parse(`<#${message.channel_id}> ${embed.footer.text}`) } : { text: parse(`<#${message.channel_id}>`) };
        }
      } else if (messageEmbed.type === 'gifv') {
        Object.assign(embed, messageEmbed);
        embed.type = 'video';
      }
    }
  }

  if (typeof embed.timestamp !== 'object') embed.timestamp = new Timestamp(embed.timestamp);

  return <MessageAccessories message={new MessageTemplate({ embeds: [ embed ] })} channel={getChannel(channelId)} gifAutoPlay={true} inlineAttachmentMedia={true} inlineEmbedMedia={true} />;
});
