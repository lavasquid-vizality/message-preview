import { getModule } from '@vizality/webpack';

const { getMember } = getModule(m => m.getMember);

export default (guildId, userId) => {
  const member = getMember(guildId, userId);

  return member?.colorString;
};
