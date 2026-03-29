const fs = require('fs');

let code = fs.readFileSync('src/pages/DashboardPanel.jsx', 'utf8');

// 1. Add imports after the ConfigModal import
code = code.replace(
    "import ConfigModal from '../components/dashboard/ConfigModal';",
    `import ConfigModal from '../components/dashboard/ConfigModal';
import { DashboardProvider } from '../context/DashboardContext';
import TransactionModal from '../components/dashboard/TransactionModal';`
);

// 2. Add the context value object right before `return (`
const contextValue = `
    // ────────────────────────────────────────────
    // CONTEXT VALUE: All state & handlers shared
    //   with sub-components via DashboardContext
    // ────────────────────────────────────────────
    const dashboardContextValue = {
        // Identity
        myUserId, myEmployeeId, userRole,
        // Data
        services, employees, customers, vehicles, transactions, memberships,
        expenses,
        // UI State
        dateFilter, setDateFilter,
        dateRange, setDateRange,
        viewMode, setViewMode,
        activeDetailModal, setActiveDetailModal,
        selectedTransaction, setSelectedTransaction,
        isModalOpen, setIsModalOpen,
        editingTransactionId, setEditingTransactionId,
        isRefreshing, setIsRefreshing,
        isConfigModalOpen, setIsConfigModalOpen,
        qrTransactionId, setQrTransactionId,
        verifyingTransaction, setVerifyingTransaction,
        hasConsentedVerification, setHasConsentedVerification,
        isUploadingPhoto, setIsUploadingPhoto,
        photoToUpload, setPhotoToUpload,
        viewingPhoto, setViewingPhoto,
        showAssignmentModal, setShowAssignmentModal,
        assigningTransactionId, setAssigningTransactionId,
        selectedEmployeesForAssignment, setSelectedEmployeesForAssignment,
        // Form State
        formData, setFormData,
        isSubmitting, setIsSubmitting,
        error, setError,
        activeTab, setActiveTab,
        newExtra, setNewExtra,
        customerSearch, setCustomerSearch,
        showCustomerSearch, setShowCustomerSearch,
        plateSearch, setPlateSearch,
        isAddingCustomer, setIsAddingCustomer,
        newCustomer, setNewCustomer,
        customerVehicles, setCustomerVehicles,
        referrerSearch, setReferrerSearch,
        showReferrerSearch, setShowReferrerSearch,
        pendingExtra, setPendingExtra,
        // Membership State
        customerMembership, setCustomerMembership,
        allCustomerMemberships, setAllCustomerMemberships,
        isMembershipUsage, setIsMembershipUsage,
        availableExtraWashes, setAvailableExtraWashes,
        isExtraWashUsage, setIsExtraWashUsage,
        // Loyalty State
        isRedemption, setIsRedemption,
        vipInfo, setVipInfo,
        canRedeemPoints, setCanRedeemPoints,
        lastService, setLastService,
        // Settings
        reviewLink, setReviewLink,
        stripeLink, setStripeLink,
        // Handlers / helpers
        getServiceName,
        getCustomerName,
        getEmployeeName,
        calculateTxTotal,
        getTransactionCategory,
        handleCustomerSelect,
        handleSubmit,
        handleStartService,
        handleAssignMembership,
        handleRemoveMembership,
        applyLastService,
        refreshTransactions,
        refreshCustomers,
        // Report
        statsTransactions,
        expenses,
        getPRDateString,
        // Feedback
        feedbacks,
        // Debug
        debugInfo, setDebugInfo,
    };

`;

code = code.replace(
    '    console.log("VERSION 3.7 NUCLEAR LOADED");\n    return (',
    `${contextValue}    console.log("VERSION 3.7 NUCLEAR LOADED");
    return (
        <DashboardProvider value={dashboardContextValue}>`
);

// 3. Close the provider before the last `);`
// The main div closes with `</div >` then `);\n};`
code = code.replace(
    '        </div >\n    );\n};\n\nexport default Dashboard;',
    `        </div >
        </DashboardProvider>
    );
};

export default Dashboard;`
);

fs.writeFileSync('src/pages/DashboardPanel.jsx', code);
console.log('Done! DashboardProvider wired up.');
