// === bot.js ===
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import { weatherAgent } from './agents';

import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new LibSQLStore({ url: ":memory:" }),
  logger: createLogger({ name: 'Mastra', level: 'info' }),
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const userStates = new Map();

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userInput = ctx.message.text.trim();

  const result = await axios.get('http://localhost:3001/api/serviceProviders');
  const data = result.data.providers.slice(0, 5);

  if (userInput.toLowerCase().includes('iş ilanları')) {
    const result = await axios.get('http://localhost:3001/api/serviceProviders');
    const data = result.data.providers.slice(0, 5);

    if (data.length === 0) {
      await ctx.reply('Hiç ilan bulunamadı.');
      return;
    }

    const message = data.map((item, index) => 
      `${index + 1}. ${item.name} – ${item.category} (${item.rating} ⭐)\n${item.location} – ${item.available ? 'Müsait' : 'Meşgul'} ${item.reservedTime}`
    ).join('\n\n');

    await ctx.replyWithMarkdown(message);
    return;
  }

  const existing = userStates.get(userId);

  if (existing && existing.waitingFor) {
    const field = existing.waitingFor;
    existing[field] = userInput;
    existing.waitingFor = undefined;

    const remaining = ['location', 'date', 'time'].filter(key => !existing[key]);

    if (remaining.length > 0) {
      existing.waitingFor = remaining[0];
      const nextQuestion = {
        location: "Lütfen konumunuzu belirtir misiniz?",
        date: "Hangi gün için randevu oluşturmak istersiniz?",
        time: "Saat kaçta hizmet almak istiyorsunuz?",
      }[existing.waitingFor];
      await ctx.reply(nextQuestion);
      return;
    }

    const categoryData = data.serviceCategories.find(
      (cat) => cat.categoryName.toLowerCase() === existing.category.toLowerCase()
    );

    if (!categoryData) {
      await ctx.reply("Bu kategoriye ait bir veri bulunamadı.");
      userStates.delete(userId);
      return;
    }

    const availableProviders = categoryData.providers.filter(
      (p) => p.availability && (!existing.location || p.location.toLowerCase().includes(existing.location.toLowerCase()))
    );

    if (availableProviders.length === 0) {
      await ctx.reply("Bu kategoride şu anda müsait görevli bulunmamaktadır.");
      userStates.delete(userId);
      return;
    }

    const message = `🧾 *Müsait Görevliler – ${existing.category}*\n\n` +
      availableProviders.map((p, index) =>
        `${index + 1}. ${p.fullName} – ${p.location} (${p.rating} ⭐)`
      ).join('\n');

    await ctx.reply(message, { parse_mode: 'Markdown' });
    userStates.delete(userId);
    return;
  }

  try {
    const response = await weatherAgent.generate([
      { role: "user", content: userInput },
    ]);

    const raw = response.text.trim();
    const cleaned = raw.replace(/^```json|```$/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const { category, missing } = parsed;

    const state = {
      category,
      location: undefined,
      date: undefined,
      time: undefined,
      waitingFor: undefined,
    };

    if (missing && missing.length > 0) {
      state.waitingFor = missing[0];
      userStates.set(userId, state);

      const questions = {
        location: "Lütfen konumunuzu belirtir misiniz?",
        date: "Hangi gün için randevu oluşturmak istersiniz?",
        time: "Saat kaçta hizmet almak istiyorsunuz?",
      };

      await ctx.reply(questions[state.waitingFor]);
      return;
    }

    const categoryData = data.serviceCategories.find(
      (cat) => cat.categoryName.toLowerCase() === category.toLowerCase()
    );

    if (!categoryData) {
      await ctx.reply("Bu kategoriye ait bir veri bulunamadı.");
      return;
    }

    const availableProviders = categoryData.providers.filter(
      (p) => p.availability && (!state.location || p.location.toLowerCase().includes(state.location.toLowerCase()))
    );

    if (availableProviders.length === 0) {
      await ctx.reply("Bu kategoride şu anda müsait görevli bulunmamaktadır.");
      return;
    }

    const message = `🧾 *Müsait Görevliler – ${category}*\n\n` +
      availableProviders.map((p, index) =>
        `${index + 1}. ${p.fullName} – ${p.location} (${p.rating} ⭐)`
      ).join('\n');

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('Hata:', err);
    await ctx.reply('Bir hata oluştu.');
  }
});

bot.launch().then(() => {
  console.log('Telegram botu başlatıldı!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));