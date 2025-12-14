# Use a lightweight Python base image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy dependency file first (for better caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copy the rest of the application code
COPY . .

# Expose the port Flask runs on
EXPOSE 5000

# Run the app using Gunicorn (Production Server)
# usage: gunicorn -w 4 -b 0.0.0.0:5000 app:app
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]