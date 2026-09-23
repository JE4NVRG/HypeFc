"use client"

import { buildLeagueIntel, type TeamIntel } from '@/lib/leagueStats'
import type { Standing } from '@/hooks/useDashboardData'

interface LeagueIntelProps {
  table: Standing[]
  home?: Standing[]
  away?: Standing[]
  leagueName: string
  loading: boolean
}

function toSide(row: Standing) {
  return {
    team: row.team,
    crest: row.crest,
    pos: row.pos,
    played: row.played,
    points: row.pts,
    goalsFor: row.goalsFor || 0,
    goalsAgainst: row.goalsAgainst || 0,
    form: row.form,
  }
}

function FormMarks({ form }: { form: Array<'W' | 'D' | 'L'> }) {
  if (!form.length) return <span className="text-slate-600">—</span>
  return (
    <span className="font-mono tracking-tight">
      {form.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={letter === 'W' ? 'text-emerald-300' : letter === 'D' ? 'text-slate-400' : 'text-red-300'}
        >
          {letter}
        </span>
      ))}
    </span>
  )
}

function Leader({ label, team, value }: { label: string; team: TeamIntel | null; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-100">{team?.team || '—'}</p>
      <p className="font-mono text-xs text-orange-300">{value}</p>
    </div>
  )
}

export function LeagueIntel({ table, home = [], away = [], leagueName, loading }: LeagueIntelProps) {
  const intel = !loading && table.length
    ? buildLeagueIntel(table.map(toSide), home.map(toSide), away.map(toSide))
    : null

  return (
    <section className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/80">Leitura da liga</p>
          <h2 className="text-base font-semibold text-white">{leagueName || 'Estatísticas'}</h2>
        </div>
        {intel && (
          <p className="text-right font-mono text-[11px] text-slate-400">
            {intel.profile.matches} jogos · {intel.profile.goalsPerMatch} gols/jogo
            {intel.profile.homePointsShare != null ? ` · ${Math.round(intel.profile.homePointsShare * 100)}% pts em casa` : ''}
          </p>
        )}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      ) : !intel ? (
        <p className="py-8 text-center text-sm text-slate-500">Sem base estatística para esta liga.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 border-y border-white/5 py-3 sm:grid-cols-4">
            <Leader label="Ataque" team={intel.leaders.attack} value={intel.leaders.attack ? `${intel.leaders.attack.gfPerGame} GF/j` : '—'} />
            <Leader label="Defesa" team={intel.leaders.defense} value={intel.leaders.defense ? `${intel.leaders.defense.gaPerGame} GA/j` : '—'} />
            <Leader label="Fortaleza" team={intel.leaders.homeBias} value={intel.leaders.homeBias?.homeBias != null ? `${intel.leaders.homeBias.homeBias > 0 ? '+' : ''}${intel.leaders.homeBias.homeBias} PPG casa` : '—'} />
            <Leader label="Forma" team={intel.leaders.form} value={intel.leaders.form ? `${intel.leaders.form.formPoints} pts / 5` : '—'} />
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[2rem_1fr_3.2rem_3.2rem_3.2rem_3.2rem_3.2rem_4.5rem] gap-2 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span>#</span>
                <span>Time</span>
                <span className="text-right">PPG</span>
                <span className="text-right">GF/j</span>
                <span className="text-right">GA/j</span>
                <span className="text-right">Casa</span>
                <span className="text-right">Fora</span>
                <span className="text-right">Forma</span>
              </div>
              {intel.teams.map((team) => (
                <div
                  key={team.team}
                  className="grid grid-cols-[2rem_1fr_3.2rem_3.2rem_3.2rem_3.2rem_3.2rem_4.5rem] items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-white/[0.04]"
                >
                  <span className="font-mono text-slate-500">{team.pos}</span>
                  <span className="truncate font-medium text-slate-100">
                    {team.team}
                    <span className="ml-2 font-mono text-[10px] text-slate-600">A{team.attackRank} D{team.defenseRank}</span>
                  </span>
                  <span className="text-right font-mono text-slate-200">{team.ppg}</span>
                  <span className="text-right font-mono text-emerald-300/90">{team.gfPerGame}</span>
                  <span className="text-right font-mono text-red-300/80">{team.gaPerGame}</span>
                  <span className="text-right font-mono text-slate-300">{team.homePpg ?? '—'}</span>
                  <span className="text-right font-mono text-slate-400">{team.awayPpg ?? '—'}</span>
                  <span className="text-right"><FormMarks form={team.form} /></span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
            Casa/fora só entra com 3 jogos de cada lado. Posse, chutes e chutes no gol vêm da ESPN, sem chave. xG continua fora: nenhuma API grátis estável entrega isso.
          </p>
        </>
      )}
    </section>
  )
}
