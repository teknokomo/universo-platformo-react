import React, { lazy } from 'react';
import { Outlet } from 'react-router-dom';
import MainLayoutMUI from '../layout/MainLayoutMUI';
import Dashboard from '../views/dashboard/Dashboard';
import { ErrorBoundary } from '../components';

// Import AuthGuard from main UI package
// @ts-ignore - JS file imported in TS
import AuthGuard from '@ui/routes/AuthGuard';

// Import Loadable utility from main UI package  
// @ts-ignore - JS file imported in TS
import Loadable from '@ui/ui-component/loading/Loadable';

// Use existing list components from monorepo apps
// @ts-ignore - JS file imported in TS
const UnikList = Loadable(lazy(() => import('@apps/uniks-frt/base/src/pages/UnikList')));

// @ts-ignore
const MetaverseList = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.MetaverseList }))));
// @ts-ignore
const ClusterList = Loadable(lazy(() => import('@universo/resources-frt').then((m) => ({ default: m.ClusterList }))));
// @ts-ignore
const ProfilePage = Loadable(lazy(() => import('@apps/profile-frt/base/src/pages/Profile.jsx')));

// Container component for nested routes
const UniksContainer = () => <Outlet />;

// Main routes configuration object (matching MainRoutes.jsx structure)
const MainRoutesMUI = {
    path: '/',
    element: <MainLayoutMUI />,
    children: [
        {
            index: true,
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <UnikList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'uniks',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <UnikList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'metaverses',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <MetaverseList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'clusters',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <ClusterList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'profile',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <ProfilePage />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        // Temporary dashboard route for testing
        {
            path: 'dashboard-demo',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <Dashboard />
                    </ErrorBoundary>
                </AuthGuard>
            )
        }
    ]
};

export default MainRoutesMUI;
