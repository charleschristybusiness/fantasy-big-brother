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
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-blue-600 mb-4">
          Fantasy Big Brother
        </h1>
        {s ? (
          <p className="text-2xl text-slate-600">{s.name}</p>
        ) : (
          <p className="text-xl text-slate-400">No active season. Check back soon!</p>
        )}
      </div>

      {s && (
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          {!s.submissions_locked && (
            <Link
              href="/submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition text-center shadow-sm"
            >
              Submit Your Bracket
            </Link>
          )}
          <Link
            href="/leaderboard"
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-8 rounded-lg text-lg transition text-center border border-slate-200 shadow-sm"
          >
            View Leaderboard
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-blue-600 mb-6">How It Works</h2>

        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">1. Draft Your Team</h3>
            <p className="text-slate-500">
              Pick 5 houseguests ranked 1st through 5th. Your #1 pick earns 1.5x points,
              while your #5 pick earns 0.5x.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">2. Earn Points</h3>
            <p className="text-slate-500">
              Your picks earn points throughout the season based on their performance
              in competitions and how far they make it.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">3. Win the League</h3>
            <p className="text-slate-500">
              Check the leaderboard each week to see how your team stacks up
              against everyone else!
            </p>
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-4">Scoring</h3>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-blue-600 mb-2">Weekly Events (Base Points)</h4>
            <table className="w-full text-sm">
              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="py-2">HOH Win</td>
                  <td className="py-2 text-right font-mono">7 pts</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2">Veto Win</td>
                  <td className="py-2 text-right font-mono">5 pts</td>
                </tr>
                <tr>
                  <td className="py-2">Surviving the Block</td>
                  <td className="py-2 text-right font-mono">2 pts</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="font-semibold text-blue-600 mb-2">Draft Multipliers</h4>
            <table className="w-full text-sm">
              <tbody className="text-slate-600">
                {(['1st', '2nd', '3rd', '4th', '5th'] as const).map((pos, i) => (
                  <tr key={pos} className={i < 4 ? 'border-b border-slate-200' : ''}>
                    <td className="py-2">{pos} Pick</td>
                    <td className="py-2 text-right font-mono">{[1.5, 1.25, 1.0, 0.75, 0.5][i]}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold text-blue-600 mb-2">Placement Points</h4>
          <p className="text-slate-500 text-sm mb-2">
            Points awarded based on final finish (also multiplied by draft position):
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-xs text-center">
            {[
              ['1st', '40'], ['2nd', '35'], ['3rd', '30'], ['4th', '27'],
              ['5th', '25'], ['6th', '22'], ['7th', '20'], ['8th', '17'],
              ['9th', '15'], ['10th', '12'], ['11th', '10'], ['12th', '8'],
              ['13th', '6'], ['14th', '4'], ['15th', '2'], ['16th', '0'],
            ].map(([place, pts]) => (
              <div key={place} className="bg-slate-50 rounded p-2 border border-slate-100">
                <div className="text-slate-400">{place}</div>
                <div className="text-slate-900 font-mono">{pts}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {s?.submissions_locked && (
        <div className="mt-8 text-center">
          <p className="text-blue-600 text-lg font-semibold">
            Bracket submissions are currently locked.
          </p>
        </div>
      )}
    </div>
  );
}
