import { useState, useEffect, useMemo, useCallback } from 'react';
import { Category, Menu } from '../types';
import { categoryService } from '../services/categoryService';
import { menuService } from '../services/menuService';

export function useMenus(enabled: boolean = true) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      return;
    }

    let unsubCats: () => void = () => {};
    let unsubMenus: () => void = () => {};
    let catLoaded = false;
    let menuLoaded = false;

    setLoading(true);
    setError(null);

    const checkFinished = () => {
      if (catLoaded && menuLoaded) {
        setLoading(false);
      }
    };

    try {
      unsubCats = categoryService.subscribeCategories(
        (cats) => {
          setCategories(cats);
          catLoaded = true;
          checkFinished();
        },
        (err) => {
          console.error('[useMenus Error] categories:', err);
          setError(err);
          setLoading(false);
        }
      );

      unsubMenus = menuService.subscribeMenus(
        (items) => {
          setMenus(items);
          menuLoaded = true;
          checkFinished();
        },
        (err) => {
          console.error('[useMenus Error] menus:', err);
          setError(err);
          setLoading(false);
        }
      );
    } catch (err: any) {
      console.error('[useMenus Error]', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }

    return () => {
      unsubCats();
      unsubMenus();
    };
  }, [enabled, retryTrigger]);

  const filteredMenus = useMemo(() => {
    return menus.filter((menu) => {
      const matchesCat =
        selectedCategoryId === 'ALL' || menu.categoryId === selectedCategoryId;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        menu.name.toLowerCase().includes(q) ||
        menu.description.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [menus, selectedCategoryId, searchQuery]);

  return {
    categories,
    menus,
    filteredMenus,
    loading,
    error,
    retry,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
  };
}
