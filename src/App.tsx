import { RouterProvider, createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

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
                    </div>
                </div>
            </nav>
            <Outlet />
            <TanStackRouterDevtools />
        </div>
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
    return <RouterProvider router={router} />
}

export default App
