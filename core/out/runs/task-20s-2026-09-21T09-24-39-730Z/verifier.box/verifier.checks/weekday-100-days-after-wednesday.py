import json

# Statement: Today is Wednesday. What day of the week will it be 100 days from today?
# Compute independently from the statement.

days = ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday"]
# index 0 = today (Wednesday); shift by 100 days.
shift = 100 % 7
computed = days[shift]

stated = "Friday"
agrees = (computed == stated)

print(json.dumps({
    "task_id": "weekday-100-days-after-wednesday",
    "computed": computed,
    "agrees": agrees
}))
