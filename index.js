import React from 'react';
import { Plugin } from '@vizality/entities';
import { patch } from '@vizality/patcher';
import { Permissions } from '@vizality/discord/constants';
import { getModule } from '@vizality/webpack';
import { findInReactTree } from '@vizality/util/react';

import Message from './components/Message';

const { can } = getModule(m => m._dispatchToken && m.can);
const { getChannel } = getModule(m => m.getChannel && m.hasChannel);

const { repliedTextContent } = getModule('repliedTextContent');

export default class MessagePreview extends Plugin {
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
        if (!can(Permissions.VIEW_CHANNEL, getChannel(channelId)) || messageId === message.id || count > 3) continue;
        res.props.children[0].push(<Message guildId={guildId} channelId={channelId} messageId={messageId} count={count} />);
      }

      return res;
    });
  }
}
