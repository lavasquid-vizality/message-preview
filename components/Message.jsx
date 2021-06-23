/* global _ */
import React, { memo, useState, useEffect } from 'react';
import { user } from '@vizality/discord';
import { getModule } from '@vizality/webpack';

import getColor from '../api/getColor';
import getMessage from '../api/getMessage';

const { getChannel } = getModule(m => m.getChannel);
const { parse } = getModule('parse', 'parseTopic');

const Message = getModule(m => m.prototype?.isEdited);
const Timestamp = getModule(m => m.prototype?.toDate && m.prototype?.month);
const { MessageAccessories } = getModule('MessageAccessories');

export const CustomEmbed = memo(({ guildId, channelId, messageId }) => {
  const [ loading, setLoading ] = useState(true);
  const [ message, setMessage ] = useState('');

  useEffect(() => {
    (async () => {
      setMessage(await getMessage(channelId, messageId));
      setLoading(false);
    })();
  }, []);

  if (loading) return <MessageAccessories message={new Message({ embeds: [ { rawTitle: 'Loading...' } ] })} channel={getChannel(channelId)} />;
  if (Object.keys(message).length === 0) return <MessageAccessories message={new Message({ embeds: [ { rawTitle: 'Error Fetching Message!' } ] })} channel={getChannel(channelId)} />;

  let embed = {
    color: getColor(guildId, message.author.id),
    author: {
      name: message.author.username,
      iconProxyURL: user.getAvatarUrl(message.author.id),
      url: `https://discord.com/users/${message.author.id}`
    },
    rawDescription: getModule(m => m.displayName === 'renderMessageContent')({ message }, parse(message.content)),
    footer: {
      text: parse(`<#${message.channel_id}>`)
    },
    timestamp: message.timestamp
  };

  for (const attachment of message.attachments) {
    const type = attachment.content_type?.match(/image|video/)[0];

    switch (type) {
      case 'image': {
        embed.image = {
          url: attachment.url,
          proxy_url: attachment.proxy_url,
          height: attachment.height,
          width: attachment.width
        };
        break;
      }
      case 'video': {
        embed.rawDescription = '';
        embed.video = _.cloneDeep(attachment);
        embed.video.url = attachment.proxy_url;
        embed.thumbnail = {
          url: `${attachment.proxy_url}?format=jpeg`,
          proxy_url: `${attachment.proxy_url}?format=jpeg`,
          height: attachment.height,
          width: attachment.width
        };
        embed.url = attachment.url;
        break;
      }
      default: {
        if ((/\.(jpe?g|png|gif|bmp)$/i).test(attachment.filename)) embed.image = _.cloneDeep(attachment);
      }
    }
  }
  for (const messageEmbed of message.embeds) {
    const { type } = messageEmbed;

    Object.assign(embed, messageEmbed);
    delete embed.id;

    switch (type) {
      case 'gifv': {
        embed.type = 'video';
        break;
      }
      case 'rich': {
        embed = _.cloneDeep(messageEmbed);
        delete embed.id;

        if (message.fetchedMessage) {
          embed.color = `#${embed.color.toString(16)}`;
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
        if (!embed.rawTitle) embed.rawTitle = '(Embed)';
        if (!embed.footer) embed.footer = {};

        if (!embed.rawTitle.includes('(Embed)')) embed.rawTitle = `(Embed) - ${embed.rawTitle}`;
        if (typeof embed.footer.text?.[0] !== 'object') {
          embed.footer.text = embed.footer.text ? parse(`<#${message.channel_id}> ${embed.footer.text}`) : parse(`<#${message.channel_id}>`);
        }
        break;
      }
    }
  }

  if (typeof embed.timestamp !== 'object') embed.timestamp = new Timestamp(embed.timestamp);

  return <MessageAccessories message={new Message({ embeds: [ embed ] })} channel={getChannel(channelId)} gifAutoPlay={true} inlineAttachmentMedia={true} inlineEmbedMedia={true} />;
});
