FROM docker.io/fedora:31

# Install all deps in the standard repos
RUN dnf -y module install nodejs:10 && \
    dnf -y install git curl pulseaudio-libs-devel unzip nodejs make gcc gcc-c++ libcanberra-devel atlas-devel blas-devel

# Install yarn
RUN curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | tee /etc/yum.repos.d/yarn.repo
RUN dnf -y install yarn

RUN mkdir /opt/almond
COPY . /opt/almond
RUN rm -rf /opt/almond/node_modules
WORKDIR /opt/almond
RUN yarn && rm -fr /root/.cache

EXPOSE 3000
ENV THINGENGINE_HOME=/var/lib/almond-server
ENV PULSE_SOCKET=unix:/run/pulse/native

ENTRYPOINT [ "yarn", "start"]
