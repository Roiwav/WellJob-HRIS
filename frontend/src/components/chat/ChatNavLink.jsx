import { NavLink } from 'react-router-dom';
import { FiMessageCircle } from 'react-icons/fi';
import { useChat } from '../../context/ChatContext';

export default function ChatNavLink() {
  const { unreadCount } = useChat();
  return (
    <NavLink to="/chat" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
      <FiMessageCircle size={19} />
      <span>Messenger</span>
      {unreadCount > 0 && (
        <span className="ml-auto min-w-6 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold text-white" aria-label={`${unreadCount} unread messages`}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </NavLink>
  );
}
