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
      if (args[0].className === repliedTextContent) return res;

      const content = args[0].content.find ? args[0].content.find(x => x.type?.displayName === 'MaskedLink') : null;
      if (!content) return res;

      const { title } = content.props;
      const titleMatch = title.match(/https?:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d{17,19}|@me)\/(\d{17,19})\/(\d{17,19})/);
      if (titleMatch) {
        const [ , guildId, channelId, messageId ] = titleMatch;
        res.props.children[0].push(<CustomEmbed guildId={guildId} channelId={channelId} messageId={messageId} />);
      }

      return res;
    });
  }

  stop () {
    unpatchAll();
  }
}
