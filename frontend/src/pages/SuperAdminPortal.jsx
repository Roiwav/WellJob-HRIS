import { useState } from 'react';
import { ROLES } from '../constants/roles';

export default function SuperAdminPortal() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ROLES.HR_STAFF);

  const handleCreateAccount = (e) => {
    e.preventDefault();
    // TODO: Implement API call to backend to create the user account
    console.log('Creating account:', { name, email, username, password, role });
    
    // Reset form after submission
    setName(''); setEmail(''); setUsername(''); setPassword(''); setRole(ROLES.HR_STAFF);
    alert("User successfully created! They must change their password on first login.");
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Super Admin Portal
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage system access by creating accounts for HR and IT.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 max-w-4xl">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Create New Account
        </h2>
        
        <form onSubmit={handleCreateAccount} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temporary Password
              </label>
              <input
                type="password"
                required
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assign Role
              </label>
              <select
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value={ROLES.HR_STAFF}>HR Staff</option>
                <option value={ROLES.HR_MANAGER}>HR Manager</option>
                <option value={ROLES.IT_SUPPORT}>IT Support</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t dark:border-gray-700">
            <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium">
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}