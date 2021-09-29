import React from 'react';
import { Plugin } from '@vizality/entities';
import { patch } from '@vizality/patcher';
import { getModule } from '@vizality/webpack';
import { findInReactTree } from '@vizality/util/react';

import canUserViewChannel from './api/canUserViewChannel';

import { CustomEmbed } from './components/Message';

const { repliedTextContent } = getModule('repliedTextContent');

export default class extends Plugin {
  start () {
    this.patch();
  }

  patch () {
    patch(getModule(m => m.type?.displayName === 'MessageContent'), 'type', (args, res) => {
      const { className, message, content } = args[0];
      if (className === repliedTextContent) return res;
      const count = findInReactTree(content, m => m.count)?.count ?? 0;

      const contentMatches = message.content.matchAll(/https?:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})/g);
      for (const contentMatch of contentMatches) {
        const [ , guildId, channelId, messageId ] = contentMatch;
        if (!canUserViewChannel(channelId) || messageId === message.id || count > 3) continue;
        res.props.children[0].push(<CustomEmbed guildId={guildId} channelId={channelId} messageId={messageId} count={count} />);
      }

      return res;
    });
  }
}
