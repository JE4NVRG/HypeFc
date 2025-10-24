import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { league_id: string } }
) {
  try {
    const { league_id } = params;

    if (!league_id) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Buscar na tabela leagues para pegar league_name
    const { data: leagueData, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .select('name')
      .eq('id', league_id)
      .single();

    if (leagueError) throw leagueError;

    // Buscar na tabela standings: WHERE league_id = :league_id ORDER BY position ASC LIMIT 10
    const { data: standingsData, error: standingsError } = await supabaseAdmin
      .from('standings')
      .select('*')
      .eq('league_id', league_id)
      .order('position', { ascending: true })
      .limit(10);

    if (standingsError) throw standingsError;

    // Pegar captured_at = a data/hora mais recente desse mesmo league_id (MAX(captured_at))
    const { data: capturedAtData, error: capturedAtError } = await supabaseAdmin
      .from('standings')
      .select('captured_at')
      .eq('league_id', league_id)
      .order('captured_at', { ascending: false })
      .limit(1);

    if (capturedAtError) throw capturedAtError;

    // Montar o array `table` com: pos = position, team = team_name, pts = points, played, wins, draws, losses
    const table = standingsData?.map(standing => ({
      pos: standing.position,
      team: standing.team_name,
      pts: standing.points,
      played: standing.played,
      wins: standing.wins,
      draws: standing.draws,
      losses: standing.losses
    })) || [];

    const response = {
      league_id,
      league_name: leagueData?.name || league_id,
      table,
      captured_at: capturedAtData?.[0]?.captured_at || new Date().toISOString()
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching standings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch standings' },
      { status: 500 }
    );
  }
}