import { Constants } from '@vizality/discord/util';
import { getModule } from '@vizality/webpack';

const debug = false;
let lastFetch = 0;

const { get } = getModule('getAPIBaseURL');
const { Endpoints } = Constants;
const { getMessage } = getModule(m => m._dispatchToken && m.getMessage);
const MessageTemplate = getModule(m => m.prototype?.isEdited);

// queue based on https://stackoverflow.com/questions/53540348/js-async-await-tasks-queue
const Queue = (() => {
  let pending = Promise.resolve();

  const run = async (channelId, messageId) => {
    try {
      await pending;
    } finally {
      if (lastFetch > Date.now() - 2500) await new Promise(r => setTimeout(r, 2500));
      try {
        const data = await get({
          url: Endpoints.MESSAGES(channelId),
          query: {
            limit: 1,
            around: messageId
          },
          retries: 2
        });
        lastFetch = Date.now();
        if (debug) console.log(`Fetched - ${channelId} / ${messageId} - ${new Date()}`);
        if (!data.body[0]) return;
        const message = new MessageTemplate(data.body[0]);
        message.fetchedMessage = true;
        return message;
      } catch (e) { console.log(e); return; }
    }
  };

  return (channelId, messageId) => (pending = run(channelId, messageId));
})();

export default async (channelId, messageId) => {
  const message = getMessage(channelId, messageId) ?? {};

  if (Object.keys(message).length === 0 && channelId && messageId) {
    return Queue(channelId, messageId);
  }

  return message;
};
