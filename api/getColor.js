import { getModule } from '@vizality/webpack';

const { getMember } = getModule('getMember');

export default (guildId, userId) => {
  const member = getMember(guildId, userId);
  if (!member) return;
  return member.colorString;
};
