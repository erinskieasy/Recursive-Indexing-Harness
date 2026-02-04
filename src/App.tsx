import { useState } from 'react';
import { RouterProvider, createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from 'react-hot-toast';
import SettingsModal from './components/SettingsModal';


const rootRoute = createRootRoute({
    component: () => (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-8 py-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                Recursive Indexing
                            </h1>
                            <p className="text-xs text-gray-500 font-medium tracking-wide text-gray-500">
                                Recursive context accumulation engine
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => (window as any).openSettings()}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
                                title="Settings"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                            <a
                                href="/.auth/logout"
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Sign Out
                            </a>
                        </div>
                    </div>
                </div>

            </nav >
            <Outlet />
            <Toaster position="bottom-right" />
        </div >
    ),
})

import RecursiveIndexingDashboard from './components/RecursiveIndexingDashboard'

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: RecursiveIndexingDashboard,
})

const routeTree = rootRoute.addChildren([indexRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Expose openSettings to window to allow access from Router context if needed, 
    // strictly speaking better passed via context, but for this simple app window hack works for the nav button inside createRootRoute
    (window as any).openSettings = () => setIsSettingsOpen(true);

    return (
        <>
            <RouterProvider router={router} />
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    )
}

export default App
