'use client';

import { Wallet, Gift } from 'lucide-react';
import { TabGroupPage } from '@/components/tab-group-page';
import FinanceView from '@/components/views/finance-view';
import WishlistView from '@/components/views/wishlist-view';

export default function InvestPage() {
  return (
    <TabGroupPage
      tabs={[
        { id: 'finance', label: 'Finance', icon: Wallet, View: FinanceView },
        { id: 'wishlist', label: 'Wishlist', icon: Gift, View: WishlistView },
      ]}
    />
  );
}
