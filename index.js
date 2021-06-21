import React from 'react';
import { Plugin } from '@vizality/entities';
import { patch, unpatchAll } from '@vizality/patcher';
import { getModule } from '@vizality/webpack';

import { CustomEmbed } from './components/Message';

const { repliedTextContent } = getModule('repliedTextContent');

export default class extends Plugin {
  start () {
    this.patch();
  }

  patch () {
    patch(getModule(m => m.type?.displayName === 'MessageContent'), 'type', (args, res) => {
      if (args[0].className === repliedTextContent) return;
      try {
        for (const content of args[0].content) {
          if (content.type?.displayName === 'MaskedLink') {
            const { title } = content.props;
            if (!title?.includes('discord') || !title?.includes('/channels/')) return;
            const [ , guildId, channelId, messageId ] = title.match(/https?:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d{17,19}|@me)\/(\d{17,19})\/(\d{17,19})/);

            res.props.children[0].push(<CustomEmbed guildId={guildId} channelId={channelId} messageId={messageId} />);
          }
        }
      } catch (e) {
        console.log(e);
        console.log(args);
      }

      return res;
    });
  }

  stop () {
    unpatchAll();
  }
}
