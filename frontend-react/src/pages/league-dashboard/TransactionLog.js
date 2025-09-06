// src/pages/league-dashboard/TransactionLog.js - NEW FILE
import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Calendar, Filter, TrendingUp, TrendingDown, Users, DollarSign, Search } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';
import { DynastyTable } from '../../services/tableService';

const TransactionLog = ({ leagueId, leagueStatus }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState(30);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    adds: 0,
    drops: 0,
    trades: 0,
    mostActive: null
  });

  useEffect(() => {
    loadTransactions();
  }, [leagueId, filter, dateRange]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await leaguesAPI.getTransactions(leagueId, {
        transaction_type: filter === 'all' ? null : filter,
        days_back: dateRange
      });

      if (response.success) {
        setTransactions(response.transactions || []);
        calculateStats(response.transactions || []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (txns) => {
    const stats = {
      totalTransactions: txns.length,
      adds: txns.filter(t => t.transaction_type === 'add').length,
      drops: txns.filter(t => t.transaction_type === 'drop').length,
      trades: txns.filter(t => t.transaction_type === 'trade').length,
      mostActive: null
    };

    // Find most active team
    const teamCounts = {};
    txns.forEach(t => {
      const team = t.to_team || t.from_team;
      if (team && team !== 'Free Agency') {
        teamCounts[team] = (teamCounts[team] || 0) + 1;
      }
    });

    const mostActiveTeam = Object.entries(teamCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostActiveTeam) {
      stats.mostActive = { team: mostActiveTeam[0], count: mostActiveTeam[1] };
    }

    setStats(stats);
  };

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    return t.player_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           t.from_team?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           t.to_team?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const columns = [
    {
      key: 'transaction_date',
      title: 'Date',
      width: 120,
      render: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'transaction_type',
      title: 'Type',
      width: 80,
      render: (value) => {
        const badges = {
          add: { color: 'bg-green-500/20 text-green-400', icon: '➕' },
          drop: { color: 'bg-red-500/20 text-red-400', icon: '➖' },
          trade: { color: 'bg-blue-500/20 text-blue-400', icon: '🔄' },
          waiver: { color: 'bg-yellow-500/20 text-yellow-400', icon: '⏳' }
        };
        const badge = badges[value] || { color: 'bg-gray-500/20', icon: '•' };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
            {badge.icon} {value}
          </span>
        );
      }
    },
    {
      key: 'player_name',
      title: 'Player',
      width: 180
    },
    {
      key: 'position',
      title: 'Pos',
      width: 60
    },
    {
      key: 'from_team',
      title: 'From',
      width: 150,
      render: (value) => value || 'Free Agency'
    },
    {
      key: 'to_team',
      title: 'To',
      width: 150,
      render: (value) => value || 'Free Agency'
    },
    {
      key: 'salary',
      title: 'Salary',
      width: 80,
      render: (value) => value ? `$${value}` : '-'
    },
    {
      key: 'notes',
      title: 'Notes',
      width: 200,
      render: (value) => value || '-'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h1 className={dynastyTheme.components.heading.h1}>
            <ArrowRightLeft className="inline w-8 h-8 mr-2" />
            League Transactions
          </h1>
          <p className={dynastyTheme.classes.text.neutralLight}>
            Track all player movements and roster changes
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold">{stats.totalTransactions}</div>
          </div>
        </div>
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="text-sm text-green-400">Adds</div>
            <div className="text-2xl font-bold">{stats.adds}</div>
          </div>
        </div>
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="text-sm text-red-400">Drops</div>
            <div className="text-2xl font-bold">{stats.drops}</div>
          </div>
        </div>
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="text-sm text-blue-400">Trades</div>
            <div className="text-2xl font-bold">{stats.trades}</div>
          </div>
        </div>
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="text-sm text-yellow-400">Most Active</div>
            <div className="text-lg font-bold truncate">
              {stats.mostActive ? `${stats.mostActive.team} (${stats.mostActive.count})` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search players, teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${dynastyTheme.components.input} pl-10`}
                />
              </div>
            </div>

            {/* Type Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={dynastyTheme.components.input}
            >
              <option value="all">All Types</option>
              <option value="add">Adds Only</option>
              <option value="drop">Drops Only</option>
              <option value="trade">Trades Only</option>
            </select>

            {/* Date Range */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(parseInt(e.target.value))}
              className={dynastyTheme.components.input}
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 3 Months</option>
              <option value={365}>All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto"></div>
              <p className="mt-4">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length > 0 ? (
            <DynastyTable
              data={filteredTransactions}
              columns={columns}
              initialSort={{ key: 'transaction_date', direction: 'desc' }}
              maxHeight="600px"
            />
          ) : (
            <div className="text-center py-12">
              <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">No transactions found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionLog;