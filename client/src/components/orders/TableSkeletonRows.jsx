import React from 'react';

// Skeleton shimmer rows for table loading state — replaces central spinner
const SkeletonCell = ({ className = '' }) => (
    <td className={`px-4 py-3 ${className}`}>
        <div className="h-3.5 bg-gray-200 rounded animate-pulse" />
    </td>
);

const SkeletonRow = ({ cols, isFlat }) => {
    if (isFlat) {
        return (
            <tr className="border-b border-gray-50 bg-white">
                <td className="px-2 py-3"><div className="w-4 h-4 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                <td className="px-3 py-3"><div className="h-3.5 w-16 bg-gray-300 rounded animate-pulse font-bold" /></td>
                <td className="px-3 py-3"><div className="h-3 w-20 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                <td className="px-3 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-3 py-3"><div className="h-3 w-28 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-3 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-2 py-3"><div className="h-3 w-6 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                <td className="px-3 py-3"><div className="h-5 w-16 bg-blue-100 rounded animate-pulse mx-auto" /></td>
                <td className="px-3 py-3"><div className="h-3 w-28 bg-gray-200 rounded animate-pulse font-mono" /></td>
                <td className="px-4 py-3"><div className="h-3 w-10 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 w-10 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 w-8 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 w-32 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-5 w-16 bg-orange-100 rounded animate-pulse mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 w-10 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 w-10 bg-orange-200 rounded animate-pulse ml-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 w-10 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                <td className="px-4 py-3"><div className="h-8 w-20 bg-indigo-50 rounded animate-pulse mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-5 w-20 bg-blue-50 rounded animate-pulse mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 w-14 bg-teal-100 rounded animate-pulse ml-auto" /></td>
                <td className="px-4 py-3"><div className="h-5 w-20 bg-teal-50 rounded animate-pulse mx-auto" /></td>
            </tr>
        );
    }
    // Tree mode skeleton
    return (
        <tr className="border-b border-gray-50 bg-white">
            <td className="px-4 py-3"><div className="w-4 h-4 bg-gray-200 rounded animate-pulse mx-auto" /></td>
            <td className="px-4 py-3"><div className="h-3.5 w-16 bg-gray-300 rounded animate-pulse" /></td>
            <td className="px-4 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
            <td className="px-4 py-3"><div className="h-3 w-24 bg-blue-100 rounded animate-pulse" /></td>
            <td className="px-4 py-3"><div className="h-3 w-40 bg-gray-200 rounded animate-pulse" /></td>
            <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse mx-auto" /></td>
            <td className="px-4 py-3"><div className="flex gap-1 justify-center"><div className="h-6 w-6 bg-gray-200 rounded animate-pulse" /><div className="h-6 w-6 bg-gray-200 rounded animate-pulse" /></div></td>
        </tr>
    );
};

const TableSkeletonRows = ({ count = 8, isFlat = false }) => (
    <>
        {Array.from({ length: count }, (_, i) => (
            <SkeletonRow key={i} isFlat={isFlat} />
        ))}
    </>
);

export default TableSkeletonRows;
