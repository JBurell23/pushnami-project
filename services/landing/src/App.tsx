import React, { useEffect, useState } from 'react';
import './style.css';

interface Assignment {
  visitorId: string;
  experiment: string;
  variant: 'A' | 'B';
  enabled: boolean;
  features: {
    showTrailerSection?: boolean;
    ctaTargetUrl?: string;
    showPollSection?: boolean;
    showFavoriteGunSection?: boolean;
    showTierRankingSection?: boolean;
    useVariantSpecificCta?: boolean;
    enablePollBasedReassignment?: boolean;
  };
}

const AB_SERVICE_URL = import.meta.env.VITE_AB_SERVICE_URL || 'http://localhost:4001';
const METRICS_SERVICE_URL = import.meta.env.VITE_METRICS_SERVICE_URL || 'http://localhost:4002';

const GUNS = ['Anvil', 'Aphelion', 'Arpeggio', 'Bettina', 'Bobcat', 'Burletta', 'Equalizer', 'Ferro', 'Hairpin', 'Hullcracker', 'Il Toro', 'Jupiter', 'Kettle', 'Osprey', 'Rattler', 'Renegade', 'Stitcher', 'Tempest', 'Torrente', 'Venator', 'Vulcano'];

function App() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [pvpPercent, setPvpPercent] = useState(50);
  const [pvePercent, setPvePercent] = useState(50);
  const [pollSubmitted, setPollSubmitted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [scrollDepthsTracked, setScrollDepthsTracked] = useState<Set<number>>(new Set());
  const [pageLoadTime] = useState(Date.now());
  const [favoriteGun, setFavoriteGun] = useState<string>('');
  const [tierRankings, setTierRankings] = useState<Record<string, string>>(
    GUNS.reduce((acc, gun) => ({ ...acc, [gun]: '' }), {} as Record<string, string>)
  );

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      if (!assignment) return;

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.round((scrollTop / scrollHeight) * 100);

      // Track milestones: 25%, 50%, 75%, 100%
      const milestones = [25, 50, 75, 100];
      milestones.forEach((milestone) => {
        if (scrollPercent >= milestone && !scrollDepthsTracked.has(milestone)) {
          setScrollDepthsTracked((prev: Set<number>) => new Set([...prev, milestone]));
          
          // Send scroll depth event
          fetch(`${METRICS_SERVICE_URL}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              visitorId: assignment.visitorId,
              experiment: 'arc-raiders',
              variant: assignment.variant,
              eventType: 'scroll_depth',
              metadata: { depth: milestone },
            }),
          }).catch(console.error);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [assignment, scrollDepthsTracked]);

  // Track time on page and bounce on unload
  useEffect(() => {
    if (!assignment) return;

    const handleBeforeUnload = () => {
      const timeOnPage = Math.round((Date.now() - pageLoadTime) / 1000); // seconds

      // Send time on page event (using sendBeacon for reliability)
      const timeOnPageData = JSON.stringify({
        visitorId: assignment.visitorId,
        experiment: 'arc-raiders',
        variant: assignment.variant,
        eventType: 'time_on_page',
        metadata: { seconds: timeOnPage },
      });

      navigator.sendBeacon(
        `${METRICS_SERVICE_URL}/events`,
        new Blob([timeOnPageData], { type: 'application/json' })
      );

      // Track bounce if no interactions occurred
      if (!hasInteracted) {
        const bounceData = JSON.stringify({
          visitorId: assignment.visitorId,
          experiment: 'arc-raiders',
          variant: assignment.variant,
          eventType: 'bounce',
          metadata: { timeOnPage: timeOnPage },
        });

        navigator.sendBeacon(
          `${METRICS_SERVICE_URL}/events`,
          new Blob([bounceData], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [assignment, hasInteracted, pageLoadTime]);

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        // Check for variant override in URL (e.g., ?variant=B)
        const urlParams = new URLSearchParams(window.location.search);
        const forceVariant = urlParams.get('variant');
        const assignUrl = forceVariant 
          ? `${AB_SERVICE_URL}/assign?experiment=arc-raiders&forceVariant=${forceVariant}`
          : `${AB_SERVICE_URL}/assign?experiment=arc-raiders`;
        
        const response = await fetch(assignUrl, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch variant assignment: ${response.status}`);
        }
        
        const data = await response.json();
        setAssignment(data);

        // Track page view (non-blocking - don't fail if this fails)
        fetch(`${METRICS_SERVICE_URL}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: data.visitorId,
            experiment: 'arc-raiders',
            variant: data.variant,
            eventType: 'page_view',
          }),
        }).catch((err) => {
          console.error('Failed to track page view:', err);
          // Silently fail - metrics tracking shouldn't break the page
        });
      } catch (error) {
        console.error('Failed to fetch assignment:', error);
        // Set assignment to null so error state is shown
        setAssignment(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, []);

  const handleCtaClick = async () => {
    if (!assignment) return;

    setHasInteracted(true);
    const url = assignment.features.ctaTargetUrl || 'https://arcraiders.com';
    window.open(url, '_blank');

      const timeToCta = Math.round((Date.now() - pageLoadTime) / 1000); // seconds

    // Track CTA click (non-blocking - don't prevent navigation if tracking fails)
    fetch(`${METRICS_SERVICE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: assignment.visitorId,
        experiment: 'arc-raiders',
        variant: assignment.variant,
        eventType: 'cta_click',
        metadata: { timeToCta: timeToCta },
      }),
    }).catch((error) => {
      console.error('Failed to track CTA click:', error);
      // Silently fail - metrics tracking shouldn't break user experience
    });
  };

  const handlePollSubmit = async () => {
    if (!assignment || pollSubmitted) return;

    setHasInteracted(true);
    // Determine preference based on which side is higher
    // PvP > PvE → Variant A, PvE > PvP → Variant B, Equal → both
    const pollChoice = pvpPercent > pvePercent ? 'pvp' : pvePercent > pvpPercent ? 'pve' : 'both';

    try {
      // Save poll preference (non-blocking)
      fetch(`${METRICS_SERVICE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: assignment.visitorId,
          experiment: 'arc-raiders',
          variant: assignment.variant,
          eventType: 'poll_submit',
          metadata: {
            pollChoice,
            pvpPercent,
            pvePercent,
          },
        }),
      }).catch((err) => {
        console.error('Failed to track poll submission:', err);
      });

      // Update variant based on preference if the feature is enabled
      if (features.enablePollBasedReassignment) {
        try {
          const preferenceResponse = await fetch(`${AB_SERVICE_URL}/assign/preference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              experiment: 'arc-raiders',
              preference: pollChoice,
            }),
          });

          if (!preferenceResponse.ok) {
            throw new Error(`Failed to update variant preference: ${preferenceResponse.status}`);
          }

          await preferenceResponse.json();
        } catch (error) {
          console.error('Failed to update variant preference:', error);
          // Still mark poll as submitted even if preference update fails
        }
      }
      
      setPollSubmitted(true);
    } catch (error) {
      console.error('Failed to submit poll:', error);
      alert('Failed to submit your preference. Please try again.');
    }
  };

  const handleFavoriteGunChange = async (gun: string) => {
    if (!assignment) return;
    setFavoriteGun(gun);
    setHasInteracted(true);

    // Track favorite gun selection (non-blocking)
    fetch(`${METRICS_SERVICE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: assignment.visitorId,
        experiment: 'arc-raiders',
        variant: assignment.variant,
        eventType: 'favorite_gun_selected',
        metadata: { gun },
      }),
    }).catch((error) => {
      console.error('Failed to track favorite gun:', error);
      // Silently fail - metrics tracking shouldn't break user experience
    });
  };

  const handleTierRanking = async (gun: string, tier: string) => {
    if (!assignment) return;
    setHasInteracted(true);
    setTierRankings((prev: Record<string, string>) => ({ ...prev, [gun]: tier }));

    // Track tier ranking (non-blocking)
    fetch(`${METRICS_SERVICE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: assignment.visitorId,
        experiment: 'arc-raiders',
        variant: assignment.variant,
        eventType: 'tier_ranking',
        metadata: { gun, tier, allRankings: { ...tierRankings, [gun]: tier } },
      }),
    }).catch((error) => {
      console.error('Failed to track tier ranking:', error);
      // Silently fail - metrics tracking shouldn't break user experience
    });
  };

  const handlePvpChange = (value: number) => {
    setPvpPercent(value);
    setPvePercent(100 - value);
  };

  const handlePveChange = (value: number) => {
    setPvePercent(value);
    setPvpPercent(100 - value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-blue-500/20 blur-3xl animate-pulse"></div>
          <div className="relative text-white text-xl font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="text-red-400 text-xl">Failed to load assignment</div>
      </div>
    );
  }

  const isVariantA = assignment.variant === 'A';
  const features = assignment.features;

  return (
    <>
    <div className="w-full min-h-screen bg-gradient-to-br from-black via-gray-950 to-black text-white relative overflow-hidden">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20 ${
          isVariantA ? 'bg-red-500' : 'bg-blue-500'
        } animate-pulse`}></div>
        <div className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20 ${
          isVariantA ? 'bg-orange-500' : 'bg-cyan-500'
        } animate-pulse`}></div>
      </div>

      <header className="relative z-10 border-b border-white/10 bg-black/30 backdrop-blur-xl px-6 md:px-12 lg:px-16">
        <div className="max-w-7xl mx-auto py-5 flex justify-between items-center">
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            ARC RAIDERS
          </h1>
          <div className={`w-24 md:w-32 lg:w-40  rounded-full text-lg xl:text-xl text-center font-bold backdrop-blur-sm border ${
            isVariantA 
              ? 'bg-red-500/20 border-red-500/50 text-red-300' 
              : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
          }`}>
            Variant {assignment.variant}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto px-6 md:px-12 py-16">
        {/* Hero Section */}
        <section className="text-center mb-20">
          <div className="mb-8">
            {isVariantA ? (
              <div className="flex flex-col items-center justify-center gap-4">
                <h2 className="text-7xl md:text-8xl font-black bg-gradient-to-r from-red-400 via-orange-400 to-red-500 bg-clip-text text-transparent leading-tight">
                  Dominate Topside
                </h2>
                <div className="w-32 h-1 bg-gradient-to-r from-red-500 to-orange-500 mx-auto rounded-full"></div>
                <p className="text-2xl md:text-3xl text-gray-300 max-w-4xl mt-4 mx-auto font-light leading-relaxed">
                  Experience intense <span className="font-bold text-red-400">Player vs Player</span> combat in the ultimate extraction shooter.
                </p>
                <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                  Every match is a test of skill and surviviabilty.<br/> Bring your gear to earn more loot but risk losing it all.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4">
                <h2 className="text-7xl md:text-8xl font-black bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent leading-tight">
                  Survive the Arc
                </h2>
                <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 mx-auto rounded-full"></div>
                <p className="text-2xl md:text-3xl text-gray-300 max-w-4xl mt-4 mx-auto font-light leading-relaxed">
                  Team up and fight against overwhelming <span className="font-bold text-blue-400">Player vs Environment</span> challenges.
                </p>
                <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                  Work together to defeat the Arc for valuable loot.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleCtaClick}
            className={`group relative px-10 py-5 text-xl font-bold rounded-xl transition-all transform hover:scale-110 hover:shadow-2xl cursor-pointer ${
              isVariantA
                ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500'
            } shadow-2xl shadow-black/50`}
          >
            <span className="relative z-10">
              {features.useVariantSpecificCta 
                ? (isVariantA ? 'Enter the Arena' : 'Join the Resistance')
                : 'Buy the Game'
              }
            </span>
            <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl ${
              isVariantA ? 'bg-red-500' : 'bg-blue-500'
            }`}></div>
          </button>
        </section>

        {features.showTrailerSection && (
          <section className="mb-20">
            <h3 className="text-4xl md:text-5xl font-black text-center mb-12 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Experience the Action
            </h3>
            <div className="relative group max-w-5xl mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-blue-500/20 rounded-2xl blur-2xl group-hover:blur-3xl transition-all"></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/10 hover:border-white/20 transition-all overflow-hidden">
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full rounded-lg"
                    src="https://www.youtube.com/embed/IpeJjQDXNAE?modestbranding=1&rel=0&showinfo=0&controls=1&playsinline=1"
                    title="Arc Raiders Gameplay Trailer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>
              </div>
            </div>
          </section>
        )}

        {features.showPollSection && (
          <section className="max-w-3xl mx-auto mb-20">
            <h3 className="text-4xl md:text-5xl font-black text-center mb-12 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              What's Your Playstyle?
            </h3>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-10 border border-white/10 hover:border-white/20 transition-all">
              <div className="space-y-8 mb-8">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xl font-semibold text-gray-200">
                      PvP
                    </label>
                    <span className="text-2xl font-black text-red-400">{pvpPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={pvpPercent}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePvpChange(parseInt(e.target.value))}
                    className="w-full h-4 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-500 slider-custom"
                    style={{
                      background: `linear-gradient(to right, rgb(239 68 68) 0%, rgb(239 68 68) ${pvpPercent}%, rgb(31 41 55) ${pvpPercent}%, rgb(31 41 55) 100%)`
                    }}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xl font-semibold text-gray-200">
                      PvE
                    </label>
                    <span className="text-2xl font-black text-blue-400">{pvePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={pvePercent}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePveChange(parseInt(e.target.value))}
                    className="w-full h-4 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    style={{
                      background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${pvePercent}%, rgb(31 41 55) ${pvePercent}%, rgb(31 41 55) 100%)`
                    }}
                  />
                </div>
              </div>
              {!pollSubmitted ? (
                <button
                  onClick={handlePollSubmit}
                  className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:via-pink-500 hover:to-purple-500 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-2xl shadow-purple-500/50 cursor-pointer"
                >
                  Submit Preference
                </button>
              ) : (
                <div className="text-center">
                  <p className="text-green-400 font-bold text-xl mb-2">
                    ✓ Preference submitted!
                  </p>
                  {features.enablePollBasedReassignment ? (
                    <p className="text-gray-400 text-sm">
                      Your preferred variant will be shown on your next visit or page refresh.
                    </p>
                  ) : (
                    <p className="text-gray-400 text-sm">
                      Your preference has been recorded.
                    </p>
                  )}
                </div>
              )}
              </div>
            </div>
          </section>
        )}

        {/* Favorite Gun Question - Variant B Only */}
        {features.showFavoriteGunSection && !isVariantA && (
          <section className="max-w-4xl mx-auto mb-20">
          <h3 className="text-4xl md:text-5xl font-black text-center mb-12 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Which Gun is Your Favorite to Eliminate the Arc?
          </h3>

          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl blur-xl bg-blue-500/10"></div>
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-10 border border-white/10 hover:border-white/20 transition-all">
              <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                {GUNS.map((gun) => (
                  <button
                    key={gun}
                    onClick={() => handleFavoriteGunChange(gun)}
                    className={`group relative p-3 rounded-lg border-2 transition-all transform hover:scale-105 cursor-pointer ${
                      favoriteGun === gun
                        ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/50'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 '
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-200 text-center">{gun}</div>
                    {favoriteGun === gun && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[8px]">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {favoriteGun && (
                <div className="mt-8 text-center">
                  <p className="text-green-400 font-bold text-xl">
                    ✓ Selected: <span className="text-white">{favoriteGun}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
        )}

        {/* Tier Ranking - Variant A Only */}
        {features.showTierRankingSection && isVariantA && (
          <section className="max-w-6xl mx-auto mb-20">
          <h3 className="text-4xl md:text-5xl font-black text-center mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Rank Your Favorite PvP Guns
          </h3>
          <p className="text-center text-gray-400 mb-12 text-lg">Drag guns to their tier or click to assign</p>
          <div className="relative group">
            <div className={`absolute inset-0 rounded-2xl blur-xl ${
              isVariantA 
                ? 'bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10'
                : 'bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-indigo-500/10'
            }`}></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-10 border border-white/10 hover:border-white/20 transition-all">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
                {['S', 'A', 'B', 'C', 'D'].map((tier) => {
                  const tierColors = {
                    'S': 'from-yellow-500/20 to-orange-500/20 border-yellow-500/50',
                    'A': 'from-green-500/20 to-emerald-500/20 border-green-500/50',
                    'B': 'from-blue-500/20 to-cyan-500/20 border-blue-500/50',
                    'C': 'from-purple-500/20 to-pink-500/20 border-purple-500/50',
                    'D': 'from-gray-500/20 to-slate-500/20 border-gray-500/50',
                  };
                  return (
                    <div 
                      key={tier} 
                      data-tier={tier}
                      onDragOver={(e: React.DragEvent) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('scale-105', 'border-yellow-400');
                      }}
                      onDragLeave={(e: React.DragEvent) => {
                        e.currentTarget.classList.remove('scale-105', 'border-yellow-400');
                      }}
                      onDrop={(e: React.DragEvent) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('scale-105', 'border-yellow-400');
                        const gun = e.dataTransfer.getData('gun');
                        if (gun) {
                          handleTierRanking(gun, tier);
                        }
                      }}
                      className={`bg-gradient-to-b ${tierColors[tier as keyof typeof tierColors]} rounded-xl p-5 border-2 min-h-[220px] transition-all`}
                    >
                      <h4 className="text-2xl font-black text-center mb-4 text-white">
                        {tier === 'S' && '🏆 S Tier'}
                        {tier === 'A' && '⭐ A Tier'}
                        {tier === 'B' && '✨ B Tier'}
                        {tier === 'C' && '💫 C Tier'}
                        {tier === 'D' && '📌 D Tier'}
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(tierRankings)
                          .filter(([_, t]) => t === tier)
                          .map(([gun]) => (
                            <div
                              key={gun}
                              className="bg-black/40 backdrop-blur-sm rounded-lg p-3 text-sm font-bold text-center cursor-move border border-white/10 hover:border-white/30 transition-all"
                              draggable
                              onDragStart={(e: React.DragEvent) => {
                                e.dataTransfer.setData('gun', gun);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                            >
                              {gun}
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {Object.keys(tierRankings).map((gun) => {
                  const currentTier = tierRankings[gun];
                  const tierStyles = {
                    'S': 'border-yellow-500 bg-yellow-500/20 shadow-2xl shadow-yellow-500/50',
                    'A': 'border-green-500 bg-green-500/20 shadow-2xl shadow-green-500/50',
                    'B': 'border-blue-500 bg-blue-500/20 shadow-2xl shadow-blue-500/50',
                    'C': 'border-purple-500 bg-purple-500/20 shadow-2xl shadow-purple-500/50',
                    'D': 'border-gray-500 bg-gray-500/20 shadow-2xl shadow-gray-500/50',
                  };
                  return (
                    <div
                      key={gun}
                      draggable
                      onDragStart={(e: React.DragEvent) => {
                        e.dataTransfer.setData('gun', gun);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => {
                        // Cycle through tiers on click
                        const tiers = ['', 'S', 'A', 'B', 'C', 'D'];
                        const currentIndex = tiers.indexOf(currentTier);
                        const nextTier = tiers[(currentIndex + 1) % tiers.length];
                        handleTierRanking(gun, nextTier);
                      }}
                      className={`group relative p-4 rounded-xl border-2 cursor-move transition-all transform hover:scale-110 hover:rotate-1 ${
                        currentTier
                          ? tierStyles[currentTier as keyof typeof tierStyles]
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-sm font-bold text-center text-gray-200">{gun}</div>
                      {currentTier && (
                        <div className="text-xs text-center mt-2 font-black text-white">{currentTier} Tier</div>
                      )}
                      {!currentTier && (
                        <div className="text-xs text-center mt-2 text-gray-400">Click to rank</div>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto px-6 text-center">
          <p className="text-gray-500 text-xs">© 2026</p>
        </div>
      </footer>
    </div>
    </>
  );
}

export default App;
