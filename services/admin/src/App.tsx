import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

const AB_SERVICE_URL = import.meta.env.VITE_AB_SERVICE_URL || 'http://localhost:4001';
const METRICS_SERVICE_URL = import.meta.env.VITE_METRICS_SERVICE_URL || 'http://localhost:4002';

interface Config {
  experiment: string;
  enabled: boolean;
  toggles: {
    showTrailerSection?: boolean;
    ctaTargetUrl?: string;
    showPollSection?: boolean;
    showFavoriteGunSection?: boolean;
    showTierRankingSection?: boolean;
    useVariantSpecificCta?: boolean;
    enablePollBasedReassignment?: boolean;
  };
}

interface Stats {
  experiment: string;
  counts: Array<{
    variant: string;
    eventType: string;
    count: number;
  }>;
  conversions: Array<{
    variant: string;
    pageViews: number;
    ctaClicks: number;
    bounces: number;
    bounceRate: string;
    conversionRate: string;
    avgTimeOnPage: string;
  }>;
  scrollDepths?: Record<string, Record<string, number>>;
}

function FeatureToggles() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  // Auto-dismiss success messages after 3 seconds
  useEffect(() => {
    if (message && message.includes('success')) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${AB_SERVICE_URL}/config?experiment=arc-raiders`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
      setMessage('Failed to load config. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${AB_SERVICE_URL}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experiment: 'arc-raiders',
          enabled: config.enabled,
          toggles: config.toggles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save config: ${response.status}`);
      }

      setMessage('Config saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save config';
      setMessage(`Failed to save config: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl animate-pulse"></div>
          <div className="relative text-white text-xl font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="text-red-400 text-xl">Failed to load config</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
      <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent text-center">
        Feature Toggles
      </h1>


      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/`10 rounded-2xl blur-xl"></div>
        <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-white/10 hover:border-white/20 transition-all space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
          <div className="pr-6 flex-1">
            <label className="text-lg font-bold text-gray-200">Experiment Enabled</label>
            <p className="text-xs text-gray-400 mt-0.5">Enable or disable the A/B test</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-12 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
            <div className="pr-6 flex-1">
              <label className="text-lg font-bold text-gray-200">Show Trailer Section</label>
              <p className="text-xs text-gray-400 mt-0.5">Display the gameplay trailer section</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={config.toggles.showTrailerSection ?? false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    toggles: { ...config.toggles, showTrailerSection: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
            <div className="pr-6 flex-1">
              <label className="text-lg font-bold text-gray-200">Show Poll Section</label>
              <p className="text-xs text-gray-400 mt-0.5">Display the playstyle preference poll</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={config.toggles.showPollSection ?? false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    toggles: { ...config.toggles, showPollSection: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
            <div className="pr-6 flex-1">
              <label className="text-lg font-bold text-gray-200">Show Favorite Gun Section</label>
              <p className="text-xs text-gray-400 mt-0.5">Display the favorite gun selection</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={config.toggles.showFavoriteGunSection ?? false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    toggles: { ...config.toggles, showFavoriteGunSection: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
            <div className="pr-6 flex-1">
              <label className="text-lg font-bold text-gray-200">Show Tier Ranking Section</label>
              <p className="text-xs text-gray-400 mt-0.5">Display the gun tier ranking section</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={config.toggles.showTierRankingSection ?? false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    toggles: { ...config.toggles, showTierRankingSection: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
            <div className="pr-6 flex-1">
              <label className="text-lg font-bold text-gray-200">Use Variant-Specific CTA</label>
              <p className="text-xs text-gray-400 mt-0.5">ON: variant text | OFF: "Buy the Game"</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={config.toggles.useVariantSpecificCta ?? false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    toggles: { ...config.toggles, useVariantSpecificCta: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
            <div className="pr-6 flex-1">
              <label className="text-lg font-bold text-gray-200">Enable Poll-Based Reassignment</label>
              <p className="text-xs text-gray-400 mt-0.5">ON: poll changes variant | OFF: variant stays same</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={config.toggles.enablePollBasedReassignment ?? false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    toggles: { ...config.toggles, enablePollBasedReassignment: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="px-2 pt-2">
            <label className="block text-lg font-bold text-gray-200 mb-1">
              CTA Target URL
            </label>
            <p className="text-xs text-gray-400 mb-3">
              URL to open when the CTA button is clicked
            </p>
            <input
              type="text"
              value={config.toggles.ctaTargetUrl || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  toggles: { ...config.toggles, ctaTargetUrl: e.target.value },
                })
              }
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-500 transition-all"
              placeholder="https://arcraiders.com"
            />
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 p-3 rounded-xl backdrop-blur-sm border ${
              message.includes('success')
                ? 'bg-green-500/20 border-green-500/50 text-green-300'
                : 'bg-red-500/20 border-red-500/50 text-red-300'
            }`}
          >
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-2xl shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
      </div>
    </div>
  );
}

function StatsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${METRICS_SERVICE_URL}/stats?experiment=arc-raiders`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Stats will remain null, error state will be shown
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl animate-pulse"></div>
          <div className="relative text-white text-xl font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="text-red-400 text-xl">Failed to load stats</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent text-center">
        Stats Dashboard
      </h1>
      <p className="text-gray-400 mb-12 text-lg text-center">Real-time experiment analytics</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {stats.conversions.map((conv) => (
          <div key={conv.variant} className="relative group">
            <div className={`absolute inset-0 rounded-2xl blur-xl ${
              conv.variant === 'A' ? 'bg-red-500/10' : 'bg-blue-500/10'
            }`}></div>
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-8 md:p-10 border border-white/10 hover:border-white/20 transition-all">
              <h2 className={`text-3xl font-black mb-6 bg-gradient-to-r bg-clip-text text-transparent ${
                conv.variant === 'A' 
                  ? 'from-red-400 to-orange-400' 
                  : 'from-blue-400 to-cyan-400'
              }`}>
                Variant {conv.variant}
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-300">Page Views:</span>
                  <span className="font-bold text-white text-lg">{conv.pageViews}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-300">CTA Clicks:</span>
                  <span className="font-bold text-white text-lg">{conv.ctaClicks}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-300">Bounces:</span>
                  <span className="font-bold text-white text-lg">{conv.bounces}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-300">Avg Time on Page:</span>
                  <span className="font-bold text-white text-lg">{conv.avgTimeOnPage}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-white/20">
                  <span className="text-gray-200 font-bold text-lg">Conversion Rate:</span>
                  <span className="font-black text-2xl text-blue-400">
                    {conv.conversionRate}%
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-200 font-bold text-lg">Bounce Rate:</span>
                  <span className="font-black text-2xl text-red-400">
                    {conv.bounceRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.scrollDepths && Object.keys(stats.scrollDepths).length > 0 && (
        <div className="relative group mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-8 md:p-10 border border-white/10 hover:border-white/20 transition-all">
            <h2 className="text-3xl font-black mb-8 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Scroll Depth by Variant
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Object.entries(stats.scrollDepths).map(([variant, depths]) => (
                <div key={variant} className="bg-black/20 rounded-xl p-6 md:p-8 border border-white/5">
                  <h3 className={`text-xl font-bold mb-6 ${
                    variant === 'A' ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    Variant {variant}
                  </h3>
                  <div className="space-y-3">
                    {[25, 50, 75, 100].map((depth) => (
                      <div key={depth} className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-gray-300">{depth}% depth:</span>
                        <span className="font-bold text-white">{depths[depth] || 0} users</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl"></div>
        <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-8 md:p-10 border border-white/10 hover:border-white/20 transition-all">
          <h2 className="text-3xl font-black mb-8 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Event Counts by Variant
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-4 px-6 md:px-8 text-gray-200 font-bold">Variant</th>
                  <th className="text-left py-4 px-6 md:px-8 text-gray-200 font-bold">Event Type</th>
                  <th className="text-right py-4 px-6 md:px-8 text-gray-200 font-bold">Count</th>
                </tr>
              </thead>
              <tbody>
                {stats.counts.map((count, idx) => (
                  <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6 md:px-8 text-gray-300 font-semibold">{count.variant}</td>
                    <td className="py-4 px-6 md:px-8 text-gray-300">{count.eventType}</td>
                    <td className="py-4 px-6 md:px-8 text-right font-bold text-white">{count.count}</td>
                  </tr>
                ))}
                {stats.counts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-gray-500">
                      No events recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Navigation() {
  const location = useLocation();

  return (
    <nav className="relative z-10 border-b border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex space-x-8">
          <Link
            to="/"
            className={`py-5 px-3 border-b-2 transition-colors font-semibold ${
              location.pathname === '/'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            Feature Toggles
          </Link>
          <Link
            to="/stats"
            className={`py-5 px-3 border-b-2 transition-colors font-semibold ${
              location.pathname === '/stats'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            Stats Dashboard
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black text-white relative overflow-hidden">
        {/* Animated background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20 bg-blue-500 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20 bg-purple-500 animate-pulse delay-1000"></div>
        </div>
        <Navigation />
        <div className="relative z-10">
          <Routes>
            <Route path="/" element={<FeatureToggles />} />
            <Route path="/stats" element={<StatsDashboard />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
