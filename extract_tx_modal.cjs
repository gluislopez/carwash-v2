const fs = require('fs');

const file = fs.readFileSync('src/pages/DashboardPanel.jsx', 'utf8');
const lines = file.split('\n');

// Lines are 0-indexed in array, 1-indexed in file
const modalStart = 3015 - 1; // "{" that starts `isModalOpen && (`
const modalEnd   = 3986 - 1; // "}" that closes it

// Extract the inner JSX (lines 3016..3985, i.e. the actual modal div)
const innerJSX = lines.slice(modalStart + 1, modalEnd).join('\n');

// Build the standalone TransactionModal component
const componentCode = `// TransactionModal.jsx - Extracted from DashboardPanel.jsx
import React from 'react';
import { useDashboard } from '../../context/DashboardContext';

const TransactionModal = () => {
    const {
        isModalOpen, setIsModalOpen,
        formData, setFormData,
        services, employees, customers, vehicles,
        plateSearch, setPlateSearch,
        isSubmitting, setIsSubmitting,
        error, setError,
        isRedemption, setIsRedemption,
        vipInfo, setVipInfo,
        canRedeemPoints, setCanRedeemPoints,
        handleCustomerSelect,
        handlePlateSearch,
        customerMembership, setCustomerMembership,
        isMembershipUsage, setIsMembershipUsage,
        isExtraWashUsage, setIsExtraWashUsage,
        availableExtraWashes, setAvailableExtraWashes,
        allCustomerMemberships, setAllCustomerMemberships,
        customerSearch, setCustomerSearch,
        showCustomerSearch, setShowCustomerSearch,
        customerVehicles, setCustomerVehicles,
        isAddingCustomer, setIsAddingCustomer,
        newCustomer, setNewCustomer,
        handleCreateCustomer,
        pendingExtra, setPendingExtra,
        showAssignmentModal, setShowAssignmentModal,
        memberships,
        handleSubmit,
        handleAddMembership,
        handleAutoMembershipAssign,
        handleExtraAdded,
        handleRemoveExtra,
        activeTab, setActiveTab,
        newExtra, setNewExtra,
        userRole,
        myEmployeeId,
        referrerSearch, setReferrerSearch,
        showReferrerSearch, setShowReferrerSearch,
        getServiceName,
    } = useDashboard();

    if (!isModalOpen) return null;

    return (
${innerJSX}
    );
};

export default TransactionModal;
`;

fs.writeFileSync('src/components/dashboard/TransactionModal.jsx', componentCode);
console.log('TransactionModal written!');

// ------- Patch DashboardPanel.jsx -------
// Replace lines 3015..3986 with a single <TransactionModal /> tag
const replacement = '                    <TransactionModal />';
const newLines = [
    ...lines.slice(0, modalStart),
    replacement,
    ...lines.slice(modalEnd + 1)
];

const patched = newLines.join('\n');
fs.writeFileSync('src/pages/DashboardPanel.jsx', patched);
console.log('DashboardPanel patched!');
