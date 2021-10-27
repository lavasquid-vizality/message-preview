import { user } from '@vizality/discord';
import { getModule } from '@vizality/webpack';
import { Permissions } from '@vizality/discord/constants';

const { can } = getModule(m => m.can);
const { getChannel } = getModule(m => m.getChannel && m.hasChannel);

export default (channelId) => {
  return can(Permissions.VIEW_CHANNEL, user.getCurrentUser().id, getChannel(channelId));
};
