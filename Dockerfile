FROM node:15-stretch
ENV NODE_ENV production

COPY yarn.lock .yarnrc.yml .yarn ./

RUN yarn --production

COPY . .

CMD ['yarn', 'start']
