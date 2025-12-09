export const formatToFraction = (decimal) => {
    if (!decimal) return "0";

    // Get integer part
    const integerPart = Math.floor(decimal);
    const fractionalPart = decimal - integerPart;

    // If no fraction (or very small), return integer
    if (fractionalPart < 0.01) return integerPart.toString();

    // Common fractions check
    // tolerance for floating point math
    const tolerance = 0.01;

    if (Math.abs(fractionalPart - 0.5) < tolerance) return `${integerPart > 0 ? integerPart + ' ' : ''}1/2`;
    // We could add 1/3, 1/4, etc. if needed, but 1/2 is most common for pairs.
    // If we have 3 people, it's 0.33 -> 1/3.
    if (Math.abs(fractionalPart - 0.33) < 0.02) return `${integerPart > 0 ? integerPart + ' ' : ''}1/3`;
    if (Math.abs(fractionalPart - 0.66) < 0.02) return `${integerPart > 0 ? integerPart + ' ' : ''}2/3`;
    if (Math.abs(fractionalPart - 0.25) < tolerance) return `${integerPart > 0 ? integerPart + ' ' : ''}1/4`;
    if (Math.abs(fractionalPart - 0.75) < tolerance) return `${integerPart > 0 ? integerPart + ' ' : ''}3/4`;

    // Fallback to decimal with 1 digit if weird split
    return decimal.toFixed(1).replace('.0', '');
};
