// Data Configuration & System Defaults for Rudhra Prarthana Novels
// Dynamic novel content, chapters, user profiles, and community discussions
// are fetched directly from the MySQL database API.

export const SITE_DATA = {
  announcement: null,

  author: {
    name: "Rudhra Prarthana",
    title: "Lead Author & Founder",
    bio: "Celebrated author who captures deep family values, pure romance, and authentic life journeys with emotional storytelling.",
    publishedCount: 0,
    readersCount: "350K+",
    avatar: "/profile.png",
    socials: {
      youtube: "https://www.youtube.com/@rudhraprarthanaaudionovels",
      pratilipi: "https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w",
      facebook: "https://facebook.com",
      instagram: "https://instagram.com"
    }
  },

  // Novels and Chapters: Loaded dynamically from MySQL database (/api/novels)
  novels: [],

  // Taxonomy categories
  forumCategories: [
    {
      id: "general",
      title: "General Discussions",
      desc: "General reader interactions, welcomes, and literary exchanges.",
      icon: "💬",
      topicsCount: 0,
      postsCount: 0,
      latest: "No discussions yet"
    },
    {
      id: "announcements",
      title: "Announcements",
      desc: "Official website news, novel release schedules, and updates.",
      icon: "📢",
      topicsCount: 0,
      postsCount: 0,
      latest: "No announcements yet"
    },
    {
      id: "ongoing-novels",
      title: "Ongoing Novels",
      desc: "Chapter-by-chapter discussions, theories, and reader comments.",
      icon: "📖",
      topicsCount: 0,
      postsCount: 0,
      latest: "No discussions yet"
    },
    {
      id: "completed-novels",
      title: "Completed Novels",
      desc: "In-depth reviews and reflections on completed novel series.",
      icon: "📚",
      topicsCount: 0,
      postsCount: 0,
      latest: "No reviews yet"
    },
    {
      id: "audio-novels",
      title: "Audio Novels",
      desc: "Audio listening experiences, background score, and voice acting discussions.",
      icon: "🎧",
      topicsCount: 0,
      postsCount: 0,
      latest: "No discussions yet"
    }
  ],

  // Real Topic Threads: Loaded dynamically from local database (/api/forum/topics)
  forumTopics: [],

  // Member Directory: Loaded dynamically from local database (/api/members)
  members: [],

  // Private messages threads
  messagesThreads: [],

  // Notifications
  notifications: []
};
