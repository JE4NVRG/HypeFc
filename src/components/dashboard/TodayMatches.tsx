'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Clock } from 'lucide-react';
import type { DashboardTodayResponse, Match } from '@/types';

// Mapeamento de IDs de liga para nomes - TODAS as ligas da API
const LEAGUE_NAMES: Record<string, string> = {
  // Ligas Europeias Principais
  'PL': 'Premier League',
  'PD': 'La Liga',
  'SA': 'Serie A',
  'FL1': 'Ligue 1',
  'BL1': 'Bundesliga',
  'DED': 'Eredivisie',
  'PPL': 'Primeira Liga',
  'ELC': 'Championship',
  
  // Competições Internacionais
  'CL': 'Champions League',
  'EC': 'Eurocopa',
  'WC': 'Copa do Mundo',
  
  // América do Sul
  'BSA': 'Brasileirão',
};

export function TodayMatches() {
  const [data, setData] = useState<DashboardTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/today');
      
      if (!response.ok) {
        throw new Error('Falha ao carregar jogos');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-3/4 bg-slate-700" />
        <Skeleton className="h-4 w-1/2 bg-slate-700" />
        <Skeleton className="h-4 w-2/3 bg-slate-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400 text-sm">Erro ao carregar jogos</p>
        <p className="text-slate-500 text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (!data?.matches || data.matches.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-slate-500 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Nenhum jogo programado para hoje</p>
      </div>
    );
  }

  // Agrupar jogos por liga
  const matchesByLeague = data.matches.reduce((acc, match) => {
    const leagueName = LEAGUE_NAMES[match.league_id] || match.league_id;
    if (!acc[leagueName]) {
      acc[leagueName] = [];
    }
    acc[leagueName].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  const formatTime = (dateString: string, kickoffTime?: string | null) => {
    try {
      if (kickoffTime) {
        return kickoffTime;
      }
      const date = new Date(dateString);
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
    } catch {
      return 'Horário TBD';
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(matchesByLeague).map(([leagueName, matches], index) => (
        <div key={leagueName}>
          {index > 0 && <Separator className="bg-slate-700/50" />}
          
          <div className="space-y-3">
            <Badge 
              variant="secondary" 
              className="bg-slate-700/50 text-slate-200 border-slate-600"
            >
              {leagueName}
            </Badge>
            
            <div className="space-y-2">
              {matches.map((match) => (
                <div 
                  key={match.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-slate-700/30 hover:bg-white/10 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-slate-100 font-medium text-sm">
                      {match.home_team} <span className="text-slate-400 mx-2">×</span> {match.away_team}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-mono">
                      {formatTime(match.match_date, match.kickoff_time)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}