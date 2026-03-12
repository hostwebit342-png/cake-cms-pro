
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, Order, OrderStatus, OrderPriority } from './types';
import { MOCK_USERS } from './constants';
import LoginForm from './components/LoginForm';
import Navbar from './components/Navbar';
import SPDashboard from './components/SPDashboard';
import BMSDashboard from './components/BMSDashboard';
import AdminDashboard from './components/AdminDashboard';
import OrderAlert from './components/OrderAlert';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('cms_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('cms_all_users');
    return saved ? JSON.parse(saved) : MOCK_USERS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('cms_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const [readyOrderAlert, setReadyOrderAlert] = useState<Order | null>(null);
  const [isReturnAlert, setIsReturnAlert] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Persist users
  useEffect(() => {
    localStorage.setItem('cms_all_users', JSON.stringify(users));
  }, [users]);

  // Persist orders
  useEffect(() => {
    localStorage.setItem('cms_orders', JSON.stringify(orders));
  }, [orders]);

  // Persist current session
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('cms_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('cms_user');
    }
  }, [currentUser]);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const playChime = useCallback(() => {
    initAudio();
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      // Double chime pattern
      playTone(660, now, 0.4); 
      playTone(440, now + 0.12, 0.4);
    }
  }, [initAudio]);

  const triggerAlert = useCallback((order: Order) => {
    // Play audio for everyone logged in
    playChime();
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance();
      const isReturn = order.status === OrderStatus.RETURNED;
      msg.text = isReturn 
        ? `Attention! A Return Order has been received. Flavour: ${order.flavour}. Quantity: ${order.formattedQuantity}.`
        : `Attention! New ${order.priority} order received. Flavour: ${order.flavour}. Quantity: ${order.formattedQuantity}.`;
      msg.rate = 0.85;
      msg.pitch = isReturn ? 0.9 : 1.1; // Lower pitch for returns
      window.speechSynthesis.speak(msg);
    }

    // Visual alert for BMS and Admin
    if (currentUser?.department === 'BMS' || currentUser?.role === UserRole.ADMIN) {
      setNewOrderAlert(order);
    }
  }, [currentUser, playChime]);

  const triggerCompletionAlert = useCallback((order: Order, isReturn: boolean = false) => {
    // Play audio for SP Supervisors and HODs
    if (currentUser?.role === UserRole.SP_SUPERVISOR || currentUser?.role === UserRole.SP_HOD || currentUser?.role === UserRole.ADMIN) {
      playChime();
      
      // Only show popup for normal orders, not returns
      if (!isReturn) {
        setIsReturnAlert(false);
        setReadyOrderAlert(order);
      }
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance();
        msg.text = isReturn
          ? `Attention! Return Order Received. Flavour: ${order.flavour}. Quantity: ${order.formattedQuantity}.`
          : `Attention! The ${order.priority} order you placed is ready. Flavour: ${order.flavour}. Quantity: ${order.formattedQuantity}. Please receive it.`;
        msg.rate = 0.85;
        msg.pitch = isReturn ? 1.2 : 1.0;
        window.speechSynthesis.speak(msg);
      }
    }
  }, [currentUser, playChime]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cms_orders' && e.newValue) {
        const updatedOrders: Order[] = JSON.parse(e.newValue);
        
        // Check for new orders or returns
        if (updatedOrders.length > orders.length) {
          const latest = updatedOrders[updatedOrders.length - 1];
          if (latest.status === OrderStatus.PENDING || latest.status === OrderStatus.RETURNED) {
            triggerAlert(latest);
          }
        } 
        // Check for status changes (completion or re-completion)
        else if (updatedOrders.length === orders.length) {
          updatedOrders.forEach((newOrder, index) => {
            const oldOrder = orders[index];
            if (oldOrder && (oldOrder.status === OrderStatus.PENDING || oldOrder.status === OrderStatus.RETURNED) && (newOrder.status === OrderStatus.COMPLETED || newOrder.status === OrderStatus.DONE)) {
              const isReturn = oldOrder.status === OrderStatus.RETURNED;
              triggerCompletionAlert(newOrder, isReturn);
            }
          });
        }
        
        setOrders(updatedOrders);
      }
      if (e.key === 'cms_all_users' && e.newValue) {
        setUsers(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [orders, triggerAlert, triggerCompletionAlert]);

  const handleLogin = (username: string, password?: string) => {
    const user = users.find(u => u.username === username);
    if (user) {
      if (user.password && user.password !== password) {
        alert('Invalid Password!');
        return;
      }
      setCurrentUser(user);
      initAudio();
    } else {
      alert('User not found!');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const addOrder = (order: Order) => {
    setOrders(prev => [...prev, order]);
    triggerAlert(order);
  };

  const completeOrder = (orderId: string) => {
    setOrders(prev => {
      let isReturn = false;
      const updated = prev.map(o => {
        if (o.id === orderId) {
          isReturn = o.status === OrderStatus.RETURNED;
          const status = isReturn ? OrderStatus.DONE : OrderStatus.COMPLETED;
          const timestamp = new Date().toLocaleString();
          return { 
            ...o, 
            status, 
            completedAt: timestamp,
            doneAt: isReturn ? timestamp : undefined
          };
        }
        return o;
      });
      const completedOrder = updated.find(o => o.id === orderId);
      if (completedOrder) {
        triggerCompletionAlert(completedOrder, isReturn);
      }
      return updated;
    });
  };

  const cancelOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId 
        ? { ...o, status: OrderStatus.CANCELLED, cancelledAt: new Date().toLocaleString() } 
        : o
    ));
  };

  const markOrderAsDone = (orderId: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId 
        ? { ...o, status: OrderStatus.DONE, doneAt: new Date().toLocaleString() } 
        : o
    ));
  };

  const handleAddUser = (newUser: User) => {
    setUsers(prev => [...prev, newUser]);
  };

  const handleChangePassword = (userId: string, newPassword: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPassword } : u));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, password: newPassword } : null);
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (users.length <= 1) {
      alert("Cannot delete the last user.");
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleResetLogs = () => {
    setOrders([]);
    localStorage.removeItem('cms_orders');
    alert("All order logs have been successfully reset.");
  };

  if (!currentUser) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20" onClick={initAudio}>
      <Navbar user={currentUser} onLogout={handleLogout} onChangePassword={handleChangePassword} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-12">
        {currentUser.role === UserRole.ADMIN && (
          <section className="border-b-4 border-indigo-100 pb-12">
            <div className="mb-4 flex items-center space-x-2">
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Admin View</span>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">System Control</h2>
            </div>
            <AdminDashboard 
              orders={orders} 
              users={users} 
              onAddUser={handleAddUser} 
              onChangePassword={handleChangePassword}
              onDeleteUser={handleDeleteUser}
              onResetLogs={handleResetLogs}
            />
          </section>
        )}

        {(currentUser.department === 'SP' || currentUser.role === UserRole.ADMIN) && (
          <section className={currentUser.role === UserRole.ADMIN ? "border-b-4 border-indigo-100 pb-12" : ""}>
            {currentUser.role === UserRole.ADMIN && (
              <div className="mb-4 flex items-center space-x-2">
                <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Admin View</span>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Order Placement (SP)</h2>
              </div>
            )}
            <SPDashboard 
              user={currentUser} 
              orders={orders} 
              onAddOrder={addOrder} 
              onCancelOrder={cancelOrder} 
              onMarkAsDone={markOrderAsDone}
            />
          </section>
        )}
        
        {(currentUser.department === 'BMS' || currentUser.role === UserRole.ADMIN) && (
          <section>
            {currentUser.role === UserRole.ADMIN && (
              <div className="mb-4 flex items-center space-x-2">
                <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Admin View</span>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Production Management (BMS)</h2>
              </div>
            )}
            <BMSDashboard orders={orders} onCompleteOrder={completeOrder} onTestSound={() => triggerAlert({
              id: 'TEST',
              flavour: 'Sample Flavour',
              formattedQuantity: '1 Kg',
              quantityKg: 1,
              quantityGr: 0,
              placedBy: 'System',
              timestamp: new Date().toLocaleString(),
              status: OrderStatus.PENDING,
              priority: OrderPriority.NORMAL
            })} />
          </section>
        )}
        
        {currentUser.role === UserRole.PRODUCTION_MANAGER && (
          <AdminDashboard orders={orders} showAnalytics={false} />
        )}

        {currentUser.role === UserRole.SP_HOD && (
          <div className="mt-16 pt-12 border-t-2 border-gray-200">
            <AdminDashboard orders={orders} showAnalytics={false} showExport={false} />
          </div>
        )}
      </main>

      {newOrderAlert && (
        <OrderAlert order={newOrderAlert} onClose={() => setNewOrderAlert(null)} type="NEW" />
      )}
      {readyOrderAlert && (
        <OrderAlert 
          order={readyOrderAlert} 
          onClose={() => {
            setReadyOrderAlert(null);
            setIsReturnAlert(false);
          }} 
          type="READY" 
          isReturn={isReturnAlert}
        />
      )}
    </div>
  );
};

export default App;
