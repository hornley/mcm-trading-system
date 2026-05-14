def quick_sort(items, key="name", order="asc"):
    if not items:
        return items

    def get_value(item):
        if isinstance(item, dict):
            val = item.get(key)
        else:
            val = getattr(item, key, None)
        if val is None:
            return ("", False)
        if isinstance(val, str):
            return (val.lower(), True)
        return (val, True)

    def partition(arr, low, high):
        pivot_val, _ = get_value(arr[high])
        i = low - 1
        for j in range(low, high):
            curr_val, curr_valid = get_value(arr[j])
            if not curr_valid:
                continue
            if curr_val < pivot_val:
                i += 1
                arr[i], arr[j] = arr[j], arr[i]
        arr[i + 1], arr[high] = arr[high], arr[i + 1]
        return i + 1

    def sort_helper(arr, low, high):
        if low < high:
            pi = partition(arr, low, high)
            sort_helper(arr, low, pi - 1)
            sort_helper(arr, pi + 1, high)

    valid_items = [item for item in items if get_value(item)[1] and get_value(item)[0] != ""]
    null_items = [item for item in items if not get_value(item)[1] or get_value(item)[0] == ""]

    sort_helper(valid_items, 0, len(valid_items) - 1)

    if order == "desc":
        valid_items = valid_items[::-1]

    return valid_items + null_items