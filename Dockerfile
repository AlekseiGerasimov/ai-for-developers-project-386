FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci --ignore-scripts
COPY frontend/ frontend/
RUN npm run build --workspace frontend

FROM eclipse-temurin:25-jdk-jammy AS backend
WORKDIR /build
COPY backend/ backend/
COPY contracts/openapi.yaml contracts/openapi.yaml
COPY --from=frontend /build/frontend/dist frontend/dist
RUN cd backend && sh ./mvnw --batch-mode --no-transfer-progress package -DskipTests

FROM eclipse-temurin:25-jre-jammy
WORKDIR /app
RUN groupadd --gid 10001 calendar && useradd --uid 10001 --gid calendar calendar \
    && mkdir /app/data && chown calendar:calendar /app/data
COPY --from=backend /build/backend/target/calendar.jar /app/calendar.jar
ENV PORT=8080
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/calendar.jar"]
