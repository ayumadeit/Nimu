import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Nimu comprehensive database seed...');

  // 1. Clean existing demo data if any
  const existingUser = await prisma.user.findUnique({
    where: { email: 'demo@nimu.app' },
  });

  if (existingUser) {
    console.log('Cleaning existing demo user data...');
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  // 2. Create Demo User
  const passwordHash = await argon2.hash('NimuCozy#2026!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@nimu.app',
      passwordHash,
      displayName: 'Cozy Companion',
      avatarUrl: null,
    },
  });

  console.log(`Created demo user: ${demoUser.email} (ID: ${demoUser.id})`);

  // 3. User Preferences
  await prisma.preferences.create({
    data: {
      userId: demoUser.id,
      themeId: 'matcha',
      mode: 'system',
      sidebarCollapsed: false,
      dashboardWidgets: [
        { id: 'monthlySpend', visible: true },
        { id: 'spendTrend', visible: true },
        { id: 'recentNotes', visible: true },
        { id: 'pinnedStickies', visible: true },
        { id: 'recentTransactions', visible: true },
        { id: 'savingsGoals', visible: true },
      ],
      noteDefaults: {
        fontFamily: 'serif',
        fontSize: 16,
        background: '#FAF8F5',
        layout: 'cozy',
      },
      financeDefaults: {
        currency: 'INR',
        monthlyBudget: 4500000, // ₹45,000 in paise
      },
      onboardingCompletedAt: new Date(),
    },
  });

  // 4. Custom Themes
  await prisma.customTheme.createMany({
    data: [
      {
        userId: demoUser.id,
        name: 'Lavender Dream',
        baseThemeId: 'lavender',
        light: {
          bg: '#F5F3FF',
          surface: '#FFFFFF',
          ink: '#3B2D54',
          primary: '#8B5CF6',
          secondary: '#C4B5FD',
          accent: '#EC4899',
        },
        dark: {
          bg: '#18122B',
          surface: '#251D3A',
          ink: '#EDE9FE',
          primary: '#A78BFA',
          secondary: '#7C3AED',
          accent: '#F472B6',
        },
      },
      {
        userId: demoUser.id,
        name: 'Autumn Chai',
        baseThemeId: 'matcha',
        light: {
          bg: '#FAF4EB',
          surface: '#FFFFFF',
          ink: '#432818',
          primary: '#99582A',
          secondary: '#DDA15E',
          accent: '#BC6C25',
        },
        dark: {
          bg: '#1E120A',
          surface: '#2C1B10',
          ink: '#FCEEDB',
          primary: '#DDA15E',
          secondary: '#99582A',
          accent: '#E09F3E',
        },
      },
    ],
  });

  // 5. Collections
  const collections = await Promise.all([
    prisma.collection.create({
      data: { userId: demoUser.id, name: 'Journal', color: '#F472B6', icon: 'BookHeart' },
    }),
    prisma.collection.create({
      data: { userId: demoUser.id, name: 'Work & Craft', color: '#60A5FA', icon: 'Briefcase' },
    }),
    prisma.collection.create({
      data: { userId: demoUser.id, name: 'Recipes', color: '#34D399', icon: 'Utensils' },
    }),
    prisma.collection.create({
      data: { userId: demoUser.id, name: 'Book Notes', color: '#FBBF24', icon: 'Bookmark' },
    }),
  ]);

  // 6. Tags
  const tagNames = [
    'wellness', 'ideas', 'chai', 'finance', 'reading',
    'travel', 'code', 'baking', 'design', 'plants'
  ];
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.create({
        data: { userId: demoUser.id, name },
      })
    )
  );

  // 7. Seed ~36 Realistic Notes
  const sampleNoteTitles = [
    'Morning Reflection on Stillness',
    'Masala Chai from Scratch',
    'Sourdough Starter: Day 14 Notes',
    'Quiet Architecture of Fastify & Prisma',
    'Designing for Warmth and Coziness',
    'The Books of 2026: Mid-Year Check-in',
    'Japan Itinerary: Kyoto & Kanazawa',
    'Weekend Farmer Market Routine',
    'Typography Principles for Reading Apps',
    'Budgeting Without Anxiety: Minor Units Rule',
    'Potting Soil Mixtures for Ferns and Hoyas',
    'Rainy Afternoon Playlist Curation',
    'Things That Sparked Joy This Spring',
    'Notes on Cal Newport’s Slow Productivity',
    'Cardamom Cold Brew Recipe',
    'Thoughts on Local-First Data Sovereignty',
    'Minimalist Desk Setup Checklist',
    'Matcha Whisk Maintenance Guide',
    'Habit Loops: The Cozy Evening Wind-Down',
    'Vintage Ceramic Mug Hunting in Dilli Haat',
    'Why Soft Color Palettes Ease Screen Fatigue',
    'Weekly Intentions: May 12-18',
    'Weekly Intentions: May 19-25',
    'Weekly Intentions: June 2-8',
    'Weekly Intentions: July 14-20',
    'Weekly Intentions: August 10-16',
    'Weekly Intentions: September 1-7',
    'Weekly Intentions: October 12-18',
    'Weekly Intentions: November 9-15',
    'Favorite Quotes on Simplicity & Contentment',
    'Baking Honey Lavender Madeleines',
    'Refactoring API Routers Cleanly',
    'Savings Milestones Celebration Log',
    'Winter Chai Spices Proportion Experiment',
    'Letters to My Future Self',
    'Nimu Release Notes: Phase 5 & 6',
  ];

  for (let i = 0; i < sampleNoteTitles.length; i++) {
    const title = sampleNoteTitles[i];
    const collection = collections[i % collections.length];
    const assignedTags = [tags[i % tags.length], tags[(i + 3) % tags.length]];
    const plainText = `This is a cozy personal entry for ${title}. Taking time to pause, breathe, and reflect on the small moments of everyday life. Writing in Nimu feels like a quiet corner by a sunny window with a steaming cup of cardamom chai.`;
    const words = plainText.split(' ').length;

    const content = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: title }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: plainText }],
        },
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: '“Simplicity is about subtracting the obvious and adding the meaningful.”',
                },
              ],
            },
          ],
        },
      ],
    };

    const note = await prisma.note.create({
      data: {
        userId: demoUser.id,
        collectionId: collection.id,
        title,
        content,
        plainText,
        excerpt: plainText.slice(0, 120),
        wordCount: words,
        isPinned: i < 3,
        isFavorite: i % 4 === 0,
        createdAt: new Date(Date.now() - i * 4 * 86400000),
        updatedAt: new Date(Date.now() - i * 2 * 86400000),
      },
    });

    for (const tag of assignedTags) {
      await prisma.noteTag.create({
        data: { noteId: note.id, tagId: tag.id },
      });
    }
  }

  // 8. Sticky Board & 12 Stickies
  const board = await prisma.stickyBoard.create({
    data: {
      userId: demoUser.id,
      name: 'Main Board',
    },
  });

  const sampleStickies = [
    { text: 'Water the monstera on Sundays 🌿', color: '#D5E8D4', rot: -2, pinned: true },
    { text: 'Pick up fresh sourdough & butter 🥖', color: '#FFF3B0', rot: 3, pinned: true },
    { text: 'Call Nani at 6 PM sharp ☕', color: '#F9C6D4', rot: -1, pinned: false },
    { text: 'Backup dotfiles and repos 💻', color: '#D8CCF7', rot: 2, pinned: false },
    { text: 'Idea: hand-drawn pottery shop logo', color: '#FFF3B0', rot: -3, pinned: false },
    { text: 'Review monthly budget on the 28th', color: '#FCE8E6', rot: 1, pinned: false },
    { text: 'Breathe. You have all the time you need.', color: '#D5E8D4', rot: -2, pinned: false },
    { text: 'Send postcard to Ananya in Berlin 📬', color: '#F9C6D4', rot: 2, pinned: false },
    { text: 'Clean coffee grinder burrs ☕', color: '#FFF3B0', rot: -1, pinned: false },
    { text: 'Finish chapter 8 of Slow Productivity', color: '#D8CCF7', rot: 3, pinned: false },
    { text: 'Book train tickets for Diwali', color: '#FCE8E6', rot: -2, pinned: false },
    { text: 'Try cinnamon roll recipe this Saturday 🥐', color: '#FFF3B0', rot: 1, pinned: false },
  ];

  for (let i = 0; i < sampleStickies.length; i++) {
    const s = sampleStickies[i];
    await prisma.stickyNote.create({
      data: {
        userId: demoUser.id,
        boardId: board.id,
        text: s.text,
        color: s.color,
        rotation: s.rot,
        x: (i % 4) * 220 + 40,
        y: Math.floor(i / 4) * 220 + 40,
        zIndex: i + 1,
        pinnedToDashboard: s.pinned,
      },
    });
  }

  // 9. Drawing Canvas Vector Data
  await prisma.drawing.create({
    data: {
      userId: demoUser.id,
      title: 'Botanical Fern Sketch',
      strokes: [
        {
          tool: 'pen',
          color: '#15803D',
          size: 3,
          points: [
            { x: 100, y: 100 },
            { x: 120, y: 140 },
            { x: 150, y: 190 },
            { x: 190, y: 240 },
          ],
        },
      ],
      paperPattern: 'dots',
    },
  });

  // 10. Savings Goals & Contributions
  const goalsData = [
    { name: 'MacBook Pro M4 Fund', targetMinor: 18000000, savedMinor: 11000000, icon: 'Laptop', color: '#6366F1' },
    { name: 'Japan Trip Spring 2027', targetMinor: 25000000, savedMinor: 9500000, icon: 'Plane', color: '#EC4899' },
    { name: 'Emergency Cushion', targetMinor: 15000000, savedMinor: 15000000, icon: 'ShieldCheck', color: '#10B981' },
  ];

  for (const g of goalsData) {
    const goal = await prisma.savingsGoal.create({
      data: {
        userId: demoUser.id,
        name: g.name,
        targetMinor: g.targetMinor,
        savedMinor: g.savedMinor,
        icon: g.icon,
        color: g.color,
      },
    });

    // Add 3 contribution entries per goal
    await prisma.goalContribution.createMany({
      data: [
        {
          goalId: goal.id,
          amountMinor: Math.round(g.savedMinor * 0.4),
          date: new Date('2026-06-15'),
          note: 'Initial seed contribution',
        },
        {
          goalId: goal.id,
          amountMinor: Math.round(g.savedMinor * 0.35),
          date: new Date('2026-08-20'),
          note: 'Freelance bonus deposit',
        },
        {
          goalId: goal.id,
          amountMinor: Math.round(g.savedMinor * 0.25),
          date: new Date('2026-10-10'),
          note: 'Monthly savings surplus',
        },
      ],
    });
  }

  // 11. 6 Months of Budgets
  const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  for (const month of months) {
    await prisma.budget.create({
      data: {
        userId: demoUser.id,
        month,
        totalLimitMinor: 4500000, // ₹45,000
        categoryLimits: {
          Food: 1200000,
          Groceries: 1000000,
          Shopping: 600000,
          Bills: 800000,
          Entertainment: 500000,
          Travel: 400000,
        },
      },
    });
  }

  // 12. ~270 Transactions Spanning 6 Months
  console.log('Generating ~270 realistic transactions across 6 months...');
  const expenseTemplates = [
    { category: 'Food', desc: 'Specialty pour-over coffee', min: 180, max: 280, method: 'upi' },
    { category: 'Food', desc: 'Tibetan momos with chilli sauce', min: 140, max: 220, method: 'upi' },
    { category: 'Food', desc: 'Masala dosa & filter coffee brunch', min: 210, max: 350, method: 'upi' },
    { category: 'Groceries', desc: 'Weekly organic produce & herbs', min: 650, max: 1400, method: 'upi' },
    { category: 'Groceries', desc: 'Fresh sourdough loaf & salted butter', min: 280, max: 450, method: 'card' },
    { category: 'Groceries', desc: 'Pantry dry restock & pulses', min: 800, max: 1800, method: 'card' },
    { category: 'Shopping', desc: 'Midori MD notebook & fountain pen ink', min: 850, max: 2100, method: 'card' },
    { category: 'Shopping', desc: 'Linen cushion cover', min: 450, max: 950, method: 'upi' },
    { category: 'Bills', desc: 'High-speed fiber broadband bill', min: 999, max: 1199, method: 'upi' },
    { category: 'Bills', desc: 'Electricity board bill', min: 1200, max: 2800, method: 'upi' },
    { category: 'Entertainment', desc: 'Cinema tickets & salted popcorn', min: 450, max: 800, method: 'upi' },
    { category: 'Entertainment', desc: 'Audiobook & streaming subscription', min: 299, max: 499, method: 'card' },
    { category: 'Travel', desc: 'Metro smart card recharge', min: 200, max: 500, method: 'upi' },
    { category: 'Travel', desc: 'Cab ride across town', min: 180, max: 420, method: 'upi' },
    { category: 'Health', desc: 'Ayurvedic herbal supplements', min: 400, max: 750, method: 'upi' },
  ];

  const startDate = new Date('2026-06-01T10:00:00Z');
  const endDate = new Date('2026-11-23T18:00:00Z');
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);

  const txData = [];

  // Monthly salaries and rents
  for (let m = 0; m < months.length; m++) {
    const [year, month] = months[m].split('-').map(Number);
    // Salary on 1st
    txData.push({
      userId: demoUser.id,
      type: 'income',
      amountMinor: 7500000, // ₹75,000
      category: 'Salary',
      description: 'Monthly Product Designer Salary',
      date: new Date(Date.UTC(year, month - 1, 1, 9, 30)),
      paymentMethod: 'bank',
      notes: 'Direct deposit',
    });

    // Rent on 2nd
    txData.push({
      userId: demoUser.id,
      type: 'expense',
      amountMinor: 2200000, // ₹22,000
      category: 'Bills',
      description: 'Apartment Rent & Maintenance',
      date: new Date(Date.UTC(year, month - 1, 2, 10, 0)),
      paymentMethod: 'bank',
      notes: 'NEFT transfer',
    });

    // Freelance stipend on 16th
    txData.push({
      userId: demoUser.id,
      type: 'income',
      amountMinor: 1800000, // ₹18,000
      category: 'Freelance',
      description: 'Brand Identity Design Milestone',
      date: new Date(Date.UTC(year, month - 1, 16, 14, 0)),
      paymentMethod: 'bank',
      notes: 'Client invoice #104',
    });
  }

  // Daily routine expenses across ~175 days
  for (let day = 0; day < totalDays; day++) {
    const currentDate = new Date(startDate.getTime() + day * 86400000);
    // 1 to 2 random expenses per day
    const count = (day % 3 === 0) ? 2 : 1;
    for (let c = 0; c < count; c++) {
      const template = expenseTemplates[(day * 3 + c) % expenseTemplates.length];
      const rupees = Math.floor(Math.random() * (template.max - template.min + 1)) + template.min;
      txData.push({
        userId: demoUser.id,
        type: 'expense',
        amountMinor: rupees * 100,
        category: template.category,
        description: template.desc,
        date: currentDate,
        paymentMethod: template.method,
        notes: '',
      });
    }
  }

  // Batch insert all transactions
  await prisma.transaction.createMany({
    data: txData,
  });

  console.log(`✅ Seeded ${txData.length} realistic transactions!`);
  console.log('🎉 Nimu database seed completed successfully!');
  console.log('Demo Account: demo@nimu.app / NimuCozy#2026!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
