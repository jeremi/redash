import datetime


def add_days(d, days):
    return d + datetime.timedelta(days=days)

def add_hours(d, hours):
    return d + datetime.timedelta(hours=hours)

def format_datetime(value, format='%H:%M / %d-%m-%Y'):
    return value.strftime(format)

