import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
    Analyze the user's message to determine which service category they are requesting.
    Match the intent exactly to one of the following categories:
    ['Cleaning', 'Plumbing', 'Electrician', 'Painting']

    Then, determine whether the user's message includes these details:
    - location
    - date
    - time

    Return the result as a JSON object in the following format:
    {
      "category": "Cleaning",
      "missing": ["location", "date", "time"]
    }

    If nothing is missing, return:
    {
      "category": "Cleaning",
      "missing": []
    }

    Respond with only the JSON. No explanation or extra text.
  `,
  model: google('gemini-2.5-flash-preview-04-17'),
  memory: new Memory({
    storage: new LibSQLStore({ url: 'file:../mastra.db' }),
    options: {
      lastMessages: 10,
      semanticRecall: false,
      threads: { generateTitle: false },
    },
  }),
});