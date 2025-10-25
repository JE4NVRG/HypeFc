// Cache em memória simples para otimização de performance
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live em milissegundos
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();

  set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    const ttl = ttlMinutes * 60 * 1000; // Converter para milissegundos
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Verificar se o item expirou
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Limpar itens expirados
  cleanup(): void {
    const now = Date.now();
    Array.from(this.cache.entries()).forEach(([key, item]) => {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    });
  }

  // Obter estatísticas do cache
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Instância singleton do cache
export const memoryCache = new MemoryCache();

// Limpar cache automaticamente a cada 10 minutos
if (typeof window === 'undefined') { // Apenas no servidor
  setInterval(() => {
    memoryCache.cleanup();
  }, 10 * 60 * 1000);
}

// Utilitário para criar chaves de cache consistentes
export const createCacheKey = (...parts: (string | number)[]): string => {
  return parts.join(':');
};

// Hook para cache com invalidação automática
export const withCache = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMinutes: number = 5
): Promise<T> => {
  // Tentar buscar do cache primeiro
  const cached = memoryCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Se não estiver no cache, buscar dados
  const data = await fetcher();
  
  // Salvar no cache
  memoryCache.set(key, data, ttlMinutes);
  
  return data;
};