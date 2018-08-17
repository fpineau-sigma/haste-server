FROM node
MAINTAINER Pineau Frederic <pineaufrederic@gmail.com>

RUN git clone https://github.com/fpineau-sigma/haste-server.git /opt/haste
WORKDIR /opt/haste
RUN npm install

VOLUME ["/opt/haste"]

EXPOSE 80
CMD ["npm", "start"]