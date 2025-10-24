'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award } from 'lucide-react';
import type { StandingsResponse, Standing } from '@/types';

// Mapeamento de ligas disponíveis
const AVAILABLE_LEAGUES = [
  { id: 'BSA', name: 'Brasileirão' },
  { id: 'PL', name: 'Premier League' },
  { id: 'PD', name: 'La Liga' },
  { id: 'SA', name: 'Serie A' },
  { id: 'FL1', name: 'Ligue 1' },
  { id: 'CL', name: 'Champions League' },
];

export function LeagueStandings() {
  const [selectedLeague, setSelectedLeague] = useState<string>('BSA');
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStandings(selectedLeague);
  }, [selectedLeague]);

  const fetchStandings = async (leagueId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/dashboard/standings/${leagueId}`);
      
      if (!response.ok) {
        throw new Error('Falha ao carregar classificação');
      }
      
      const data: StandingsResponse = await response.json();
      setStandings(data.standings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setStandings([]);
    } finally {
      setLoading(false);
    }
  };

  const getPositionIcon = (position: number) => {
    if (position === 1) {
      return <Trophy className="h-4 w-4 text-yellow-500" />;
    }
    if (position <= 3) {
      return <Medal className="h-4 w-4 text-slate-400" />;
    }
    if (position <= 6) {
      return <Award className="h-4 w-4 text-blue-400" />;
    }
    return null;
  };

  const getPositionStyle = (position: number) => {
    if (position === 1) {
      return 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
    }
    if (position <= 3) {
      return 'bg-gradient-to-r from-slate-500/20 to-slate-400/20 border-slate-400/30';
    }
    if (position <= 6) {
      return 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-400/30';
    }
    if (position >= standings.length - 2) {
      return 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-400/30';
    }
    return 'hover:bg-white/5';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full bg-slate-700" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Select value={selectedLeague} onValueChange={setSelectedLeague}>
        <SelectTrigger className="w-full bg-slate-800/50 border-slate-700 text-slate-200">
          <SelectValue placeholder="Selecione uma liga" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          {AVAILABLE_LEAGUES.map((league) => (
            <SelectItem 
              key={league.id} 
              value={league.id}
              className="text-slate-200 focus:bg-slate-700 focus:text-white"
            >
              {league.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error ? (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">Erro ao carregar classificação</p>
          <p className="text-slate-500 text-xs mt-1">{error}</p>
        </div>
      ) : standings.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="h-8 w-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Nenhuma classificação disponível</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700/50 bg-white/5 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700/50 hover:bg-slate-800/50">
                <TableHead className="text-slate-300 font-semibold w-16">POS</TableHead>
                <TableHead className="text-slate-300 font-semibold">TIME</TableHead>
                <TableHead className="text-slate-300 font-semibold text-center w-16">J</TableHead>
                <TableHead className="text-slate-300 font-semibold text-center w-16">V</TableHead>
                <TableHead className="text-slate-300 font-semibold text-center w-16">E</TableHead>
                <TableHead className="text-slate-300 font-semibold text-center w-16">D</TableHead>
                <TableHead className="text-slate-300 font-semibold text-center w-20">PTS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.slice(0, 10).map((team) => (
                <TableRow 
                  key={team.id}
                  className={`border-slate-700/30 transition-all duration-200 ${getPositionStyle(team.position)}`}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      {getPositionIcon(team.position)}
                      <span className="text-slate-200 font-semibold">
                        {team.position}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-100 font-medium">
                    {team.team_name}
                  </TableCell>
                  <TableCell className="text-center text-slate-300">
                    {team.played}
                  </TableCell>
                  <TableCell className="text-center text-green-400 font-medium">
                    {team.wins}
                  </TableCell>
                  <TableCell className="text-center text-yellow-400 font-medium">
                    {team.draws}
                  </TableCell>
                  <TableCell className="text-center text-red-400 font-medium">
                    {team.losses}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-slate-100 font-bold text-lg">
                      {team.points}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {standings.length > 0 && (
        <div className="text-center">
          <p className="text-slate-500 text-xs">
            Mostrando top 10 • Atualizado em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      )}
    </div>
  );
}