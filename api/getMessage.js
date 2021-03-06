import { cloneDeep } from 'lodash';
import { getModule } from '@vizality/webpack';
import { sleep } from '@vizality/util/time';

const Message = getModule(m => m.prototype?.isEdited);

const Constants = getModule(m => m.API_HOST);
const { get } = getModule(m => m.getAPIBaseURL);
const { getMessage } = getModule(m => m.getMessage && m.getMessages);

const debug = false;
let lastFetch = 0;
const fetchTime = 5000;
const cachedMessages = new Map();

// queue based on https://stackoverflow.com/questions/53540348/js-async-await-tasks-queue
const Queue = (() => {
  let pending = Promise.resolve();

  const run = async (channelId, messageId) => {
    try {
      await pending;
    } finally {
      if (lastFetch > Date.now() - fetchTime) await sleep(fetchTime);
      try {
        const data = await get({
          url: Constants.Endpoints.MESSAGES(channelId),
          query: {
            limit: 1,
            around: messageId
          },
          retries: 2
        });
        lastFetch = Date.now();
        if (debug) console.log(`Fetched - ${channelId} / ${messageId} - ${new Date()}`);
        if (!data.body[0]) return;
        const message = new Message(data.body[0]);
        message.fetchedMessage = true;
        return message;
      } catch (e) { console.log(e); return; }
    }
  };

  return (channelId, messageId) => pending = run(channelId, messageId);
})();

export default async (channelId, messageId, updateMessage) => {
  if (!channelId && !messageId) return {};

  const oldMap = cachedMessages.get(channelId);
  if (oldMap?.has(messageId) && updateMessage !== 'update') return cachedMessages.get(channelId).get(messageId);

  const message = cloneDeep(getMessage(channelId, messageId)) ?? Queue(channelId, messageId);

  const newMap = oldMap ? [ ...oldMap, [ messageId, message ] ] : [ [ messageId, message ] ];
  cachedMessages.set(channelId, new Map(newMap));

  return message;
};
