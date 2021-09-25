import { getModule } from '@vizality/webpack';
import { Permissions } from '@vizality/discord/constants';

const { can } = getModule('can');
const { getChannel } = getModule(m => m.getChannel);

export default (channelId) => {
  return can(Permissions.VIEW_CHANNEL, getChannel(channelId));
};
