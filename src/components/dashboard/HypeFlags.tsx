'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, TrendingUp } from 'lucide-react';
import type { DashboardTodayResponse, HypeFlag } from '@/types';

export function HypeFlags() {
  const [data, setData] = useState<DashboardTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHypeFlags();
  }, []);

  const fetchHypeFlags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/today');
      
      if (!response.ok) {
        throw new Error('Falha ao carregar times em alta');
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
        <Skeleton className="h-8 w-2/3 bg-slate-700" />
        <Skeleton className="h-6 w-1/2 bg-slate-700" />
        <Skeleton className="h-8 w-3/4 bg-slate-700" />
        <Skeleton className="h-6 w-1/3 bg-slate-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400 text-sm">Erro ao carregar times em alta</p>
        <p className="text-slate-500 text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (!data?.hypeFlags || data.hypeFlags.length === 0) {
    return (
      <div className="text-center py-8">
        <Flame className="h-8 w-8 text-slate-500 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Nenhum time em destaque hoje</p>
      </div>
    );
  }

  // Ordenar por prioridade (1 primeiro)
  const sortedHypeFlags = [...data.hypeFlags].sort((a, b) => a.priority - b.priority);

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-yellow-400';
      case 2:
        return 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400';
      case 3:
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400';
      case 4:
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-400';
      default:
        return 'bg-slate-700/50 text-slate-200 border-slate-600';
    }
  };

  const getPriorityIcon = (priority: number) => {
    if (priority === 1) {
      return <TrendingUp className="h-3 w-3" />;
    }
    return <Flame className="h-3 w-3" />;
  };

  return (
    <div className="space-y-3">
      {sortedHypeFlags.map((hypeFlag, index) => (
        <div 
          key={hypeFlag.id}
          className="group p-4 rounded-lg bg-white/5 border border-slate-700/30 hover:bg-white/10 transition-all duration-200 hover:border-slate-600/50"
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-slate-100 font-semibold text-sm group-hover:text-white transition-colors">
              {hypeFlag.team_name}
            </h3>
            <div className="flex items-center space-x-1 text-slate-400 text-xs">
              {getPriorityIcon(hypeFlag.priority)}
              <span>#{hypeFlag.priority}</span>
            </div>
          </div>
          
          <Badge 
            className={`${getPriorityColor(hypeFlag.priority)} text-xs font-medium`}
          >
            {hypeFlag.reason}
          </Badge>
          
          {hypeFlag.created_at && (
            <p className="text-slate-500 text-xs mt-2">
              Adicionado em {new Date(hypeFlag.created_at).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      ))}
      
      {sortedHypeFlags.length > 0 && (
        <div className="text-center pt-2">
          <p className="text-slate-500 text-xs">
            {sortedHypeFlags.length} time{sortedHypeFlags.length !== 1 ? 's' : ''} em destaque
          </p>
        </div>
      )}
    </div>
  );
}