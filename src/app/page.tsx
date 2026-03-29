import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Season } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('status', 'active')
    .limit(1)
    .single();

  const s = season as Season | null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-16 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 via-transparent to-transparent rounded-3xl" />
        <div className="relative">
          <h1 className="text-5xl sm:text-6xl font-bold text-yellow-400 mb-3 tracking-tight">
            Fantasy Big Brother
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-500 to-cyan-500 mx-auto mb-4 rounded-full" />
          {s ? (
            <p className="text-2xl text-gray-300 font-light">{s.name}</p>
          ) : (
            <p className="text-xl text-gray-400">No active season. Check back soon!</p>
          )}
        </div>
      </div>

      {/* CTA Buttons */}
      {s && (
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
          {!s.submissions_locked && (
            <Link
              href="/submit"
              className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-4 px-10 rounded-xl text-lg transition-all duration-300 text-center shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:shadow-[0_0_30px_rgba(250,204,21,0.35)]"
            >
              Submit Your Bracket
            </Link>
          )}
          <Link
            href="/leaderboard"
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-10 rounded-xl text-lg transition-all duration-300 text-center border border-gray-700 hover:border-gray-600"
          >
            View Leaderboard
          </Link>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-gray-900 rounded-2xl p-8 sm:p-10 border border-gray-800">
        <h2 className="text-2xl font-bold text-yellow-400 mb-8 text-center">How It Works</h2>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {[
            {
              step: '1',
              title: 'Draft Your Team',
              desc: 'Pick 5 houseguests ranked 1st through 5th. Your #1 pick earns 1.5x points, while your #5 pick earns 0.5x.',
              accent: 'from-yellow-500/20 to-yellow-500/0',
            },
            {
              step: '2',
              title: 'Earn Points',
              desc: 'Your picks earn points throughout the season based on their performance in competitions and how far they make it.',
              accent: 'from-cyan-500/20 to-cyan-500/0',
            },
            {
              step: '3',
              title: 'Win the League',
              desc: 'Check the leaderboard each week to see how your team stacks up against everyone else!',
              accent: 'from-fuchsia-500/20 to-fuchsia-500/0',
            },
          ].map((item) => (
            <div key={item.step} className="relative group">
              <div className={`absolute inset-0 bg-gradient-to-b ${item.accent} rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-gray-600 transition-colors duration-300">
                <div className="text-3xl font-bold text-yellow-400/30 mb-2">{item.step}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Scoring Section */}
        <h3 className="text-xl font-bold text-white mb-6 text-center">Scoring</h3>
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <h4 className="font-semibold text-yellow-400 mb-3 text-sm uppercase tracking-wider">Weekly Events</h4>
            <table className="w-full text-sm">
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-700/50">
                  <td className="py-2.5">HOH Win</td>
                  <td className="py-2.5 text-right font-mono text-cyan-400">7 pts</td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-2.5">Veto Win</td>
                  <td className="py-2.5 text-right font-mono text-cyan-400">5 pts</td>
                </tr>
                <tr>
                  <td className="py-2.5">Surviving the Block</td>
                  <td className="py-2.5 text-right font-mono text-cyan-400">2 pts</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <h4 className="font-semibold text-yellow-400 mb-3 text-sm uppercase tracking-wider">Draft Multipliers</h4>
            <table className="w-full text-sm">
              <tbody className="text-gray-300">
                {(['1st', '2nd', '3rd', '4th', '5th'] as const).map((pos, i) => (
                  <tr key={pos} className={i < 4 ? 'border-b border-gray-700/50' : ''}>
                    <td className="py-2.5">{pos} Pick</td>
                    <td className="py-2.5 text-right font-mono text-cyan-400">{[1.5, 1.25, 1.0, 0.75, 0.5][i]}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-yellow-400 mb-3 text-sm uppercase tracking-wider text-center">Placement Points</h4>
          <p className="text-gray-400 text-sm mb-3 text-center">
            Points awarded based on final finish (also multiplied by draft position):
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-xs text-center">
            {[
              ['1st', '40'], ['2nd', '35'], ['3rd', '30'], ['4th', '27'],
              ['5th', '25'], ['6th', '22'], ['7th', '20'], ['8th', '17'],
              ['9th', '15'], ['10th', '12'], ['11th', '10'], ['12th', '8'],
              ['13th', '6'], ['14th', '4'], ['15th', '2'], ['16th', '0'],
            ].map(([place, pts], i) => (
              <div key={place} className={`rounded-lg p-2.5 border transition-colors duration-200 ${
                i === 0 ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                i === 1 ? 'bg-gray-300/5 border-gray-400/20' :
                i === 2 ? 'bg-amber-500/5 border-amber-500/20' :
                'bg-gray-800 border-gray-700/50'
              }`}>
                <div className="text-gray-400">{place}</div>
                <div className={`font-mono font-bold ${i === 0 ? 'text-yellow-400' : 'text-white'}`}>{pts}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {s?.submissions_locked && (
        <div className="mt-10 text-center">
          <div className="inline-block bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-6 py-3">
            <p className="text-yellow-400 text-lg font-semibold">
              Bracket submissions are currently locked.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
