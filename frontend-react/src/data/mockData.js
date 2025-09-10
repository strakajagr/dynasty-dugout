// src/data/mockData.js
// Mock data for non-authenticated users in preview mode

export const mockLeagues = [
  {
    league_id: 'demo-1',
    league_name: 'Dynasty Masters Demo',
    status: 'ACTIVE',
    role: 'COMMISSIONER',
    league_format: 'Rotisserie (YTD)',
    max_teams: 12,
    current_teams: 12,
    salary_cap: 800,
    created_date: '2025-01-15',
    league_type: 'dynasty',
    is_demo: true
  },
  {
    league_id: 'demo-2', 
    league_name: 'Championship League Demo',
    status: 'ACTIVE',
    role: 'OWNER',
    league_format: 'Rotisserie (YTD)',
    max_teams: 10,
    current_teams: 8,
    salary_cap: 600,
    created_date: '2024-12-20',
    league_type: 'dynasty',
    is_demo: true
  },
  {
    league_id: 'demo-3',
    league_name: 'Elite Dynasty Demo',
    status: 'ACTIVE', 
    role: 'OWNER',
    league_format: 'Rotisserie (YTD)',
    max_teams: 14,
    current_teams: 14,
    salary_cap: 1000,
    created_date: '2024-11-10',
    league_type: 'dynasty',
    is_demo: true
  },
  {
    league_id: 'demo-4',
    league_name: 'Prospect Pipeline Demo',
    status: 'DRAFT_PENDING',
    role: 'COMMISSIONER',
    league_format: 'Rotisserie (YTD)', 
    max_teams: 16,
    current_teams: 12,
    salary_cap: 750,
    created_date: '2025-02-01',
    league_type: 'dynasty',
    is_demo: true
  },
  {
    league_id: 'demo-5',
    league_name: 'Baseball Legends Demo',
    status: 'ACTIVE',
    role: 'OWNER',
    league_format: 'Rotisserie (YTD)',
    max_teams: 8,
    current_teams: 8, 
    salary_cap: 900,
    created_date: '2024-09-15',
    league_type: 'dynasty',
    is_demo: true
  }
];

export const mockTrendingPlayers = [
  {
    player_id: 'demo-p1',
    name: 'Mike Trout',
    team: 'LAA', 
    position: 'OF',
    trend: 'up',
    change_percentage: 15.2,
    avg_salary: 45.8,
    ownership_percentage: 98.5,
    recent_stats: { avg: .285, hr: 4, rbi: 12, sb: 2 }
  },
  {
    player_id: 'demo-p2', 
    name: 'Ronald Acuña Jr.',
    team: 'ATL',
    position: 'OF',
    trend: 'up',
    change_percentage: 22.7,
    avg_salary: 52.3,
    ownership_percentage: 99.1,
    recent_stats: { avg: .310, hr: 6, rbi: 15, sb: 8 }
  },
  {
    player_id: 'demo-p3',
    name: 'Shohei Ohtani', 
    team: 'LAD',
    position: 'DH',
    trend: 'up',
    change_percentage: 18.9,
    avg_salary: 55.7,
    ownership_percentage: 99.8,
    recent_stats: { avg: .298, hr: 5, rbi: 14, sb: 3 }
  },
  {
    player_id: 'demo-p4',
    name: 'Juan Soto',
    team: 'NYY',
    position: 'OF', 
    trend: 'down',
    change_percentage: -8.3,
    avg_salary: 48.2,
    ownership_percentage: 96.7,
    recent_stats: { avg: .265, hr: 2, rbi: 8, sb: 1 }
  },
  {
    player_id: 'demo-p5',
    name: 'Trea Turner',
    team: 'PHI',
    position: 'SS',
    trend: 'up',
    change_percentage: 12.4,
    avg_salary: 35.6,
    ownership_percentage: 94.3,
    recent_stats: { avg: .295, hr: 3, rbi: 9, sb: 7 }
  },
  {
    player_id: 'demo-p6',
    name: 'Mookie Betts',
    team: 'LAD', 
    position: 'OF',
    trend: 'hot',
    change_percentage: 28.1,
    avg_salary: 47.9,
    ownership_percentage: 97.2,
    recent_stats: { avg: .325, hr: 7, rbi: 16, sb: 4 }
  }
];

export const mockMLBNews = [
  {
    id: 'demo-news-1',
    headline: 'Spring Training Standouts: Top Prospects Making Waves',
    summary: 'Several rookie prospects are turning heads in early spring training games with impressive performances.',
    source: 'MLB.com',
    published: '2025-03-08',
    category: 'prospects'
  },
  {
    id: 'demo-news-2', 
    headline: 'Trade Deadline Approaching: Top Targets to Watch',
    summary: 'Front offices are already planning for the summer trade deadline with several big names potentially available.',
    source: 'ESPN',
    published: '2025-03-07',
    category: 'trades'
  },
  {
    id: 'demo-news-3',
    headline: 'Injury Update: Several Stars Expected Back Soon',
    summary: 'Positive injury reports for key fantasy players as spring training progresses.',
    source: 'The Athletic', 
    published: '2025-03-06',
    category: 'injuries'
  },
  {
    id: 'demo-news-4',
    headline: 'New Rules Impact: How Changes Affect Fantasy Value',
    summary: 'Latest MLB rule modifications could significantly impact player values in dynasty formats.',
    source: 'FanGraphs',
    published: '2025-03-05',
    category: 'analysis'
  }
];

export const mockInjuryReports = [
  {
    player_id: 'demo-inj-1',
    name: 'Fernando Tatis Jr.',
    team: 'SD',
    position: 'SS',
    injury_type: 'Shoulder Strain',
    severity: 'Day-to-Day',
    expected_return: '2025-03-15',
    status: 'improving',
    impact: 'minimal'
  },
  {
    player_id: 'demo-inj-2',
    name: 'Jacob deGrom', 
    team: 'TEX',
    position: 'SP',
    injury_type: 'Elbow Soreness',
    severity: 'Week-to-Week',
    expected_return: '2025-03-20',
    status: 'monitoring',
    impact: 'moderate'
  },
  {
    player_id: 'demo-inj-3',
    name: 'Kyle Tucker',
    team: 'CHC',
    position: 'OF',
    injury_type: 'Hamstring Tightness',
    severity: 'Day-to-Day', 
    expected_return: '2025-03-12',
    status: 'improving',
    impact: 'minimal'
  },
  {
    player_id: 'demo-inj-4',
    name: 'Shane Bieber',
    team: 'CLE',
    position: 'SP',
    injury_type: 'Tommy John Recovery',
    severity: 'Long-term',
    expected_return: '2025-07-01',
    status: 'progressing',
    impact: 'significant'
  }
];

export const mockTickerUpdates = [
  'Dynasty Masters Demo: Team Dynasty Crusaders added Mike Trout',
  'Championship League Demo: Trade completed between Team Thunder and Team Lightning',
  'Elite Dynasty Demo: Waiver claim processed for Team Dynasty Kings',
  'Prospect Pipeline Demo: Draft scheduled to begin March 15th',
  'Baseball Legends Demo: Team Legends added Ronald Acuña Jr. to active roster'
];

export const mockPublicLeagues = [
  {
    league_id: 'public-demo-1',
    league_name: 'Open Dynasty Championship',
    commissioner: 'BaseballGuru23',
    format: 'Rotisserie (YTD)',
    teams: '8/12',
    salary_cap: 800,
    entry_fee: 'Free',
    draft_date: '2025-03-20',
    description: 'Competitive dynasty league looking for experienced managers',
    is_demo: true
  },
  {
    league_id: 'public-demo-2',
    league_name: 'Rookie Manager Friendly',
    commissioner: 'NewbieHelper', 
    format: 'Points League',
    teams: '6/10',
    salary_cap: 600,
    entry_fee: 'Free',
    draft_date: '2025-03-25',
    description: 'Perfect for new dynasty managers to learn the ropes',
    is_demo: true
  },
  {
    league_id: 'public-demo-3',
    league_name: 'High Stakes Dynasty Elite',
    commissioner: 'ProManager',
    format: 'Rotisserie (YTD)',
    teams: '10/14', 
    salary_cap: 1000,
    entry_fee: '$100',
    draft_date: '2025-03-18',
    description: 'Premium league for serious dynasty players only',
    is_demo: true
  }
];

// Demo user profile for preview mode
export const mockUser = {
  given_name: 'Demo',
  family_name: 'User',
  email: 'demo@dynastydugout.com',
  firstName: 'Demo',
  lastName: 'User'
};