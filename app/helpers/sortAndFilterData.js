import { helper } from '@ember/component/helper';

export function sortAndFilterData([data = []]) {
    if (!Array.isArray(data)) {
        return [];
    }

    const sortedData = [...data].sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
    });

    const inProgressData = sortedData.filter(item => !item.endTime);
    const completedData = sortedData.filter(item => item.endTime);

    return [...inProgressData, ...completedData];
}

export default helper(sortAndFilterData);
