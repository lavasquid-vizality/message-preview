import React from 'react';
import { Plugin } from '@vizality/entities';
import { patch } from '@vizality/patcher';
import { getModule } from '@vizality/webpack';

import canUserViewChannel from './api/canUserViewChannel';

import { CustomEmbed } from './components/Message';

const { repliedTextContent } = getModule('repliedTextContent');

export default class extends Plugin {
  start () {
    this.patch();
  }

  patch () {
    patch(getModule(m => m.type?.displayName === 'MessageContent'), 'type', (args, res) => {
      const { className, message } = args[0];

      if (className === repliedTextContent) return res;

      const contentMatch = message.content.match(/https?:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})/);
      if (contentMatch) {
        const [ , guildId, channelId, messageId ] = contentMatch;
        if (!canUserViewChannel(channelId) || messageId === message.id) return res;
        res.props.children[0].push(<CustomEmbed guildId={guildId} channelId={channelId} messageId={messageId} />);
      }

      return res;
    });
  }
}
